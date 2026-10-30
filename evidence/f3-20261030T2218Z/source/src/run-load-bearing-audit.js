const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const manifest = require('../evals/load-bearing-map.json');
const { contexts, checks } = require('../evals/load-bearing-cases');
const { evaluateCriterion } = require('./load-bearing-criteria');
const { buildPrompt } = require('./prompt-builder');

const root = path.resolve(__dirname, '..');
const hashFile = file => createHash('sha256').update(
  fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
).digest('hex');

function inventoryPrompt(text) {
  const units = [];
  let paragraph = [];
  const flush = () => {
    if (paragraph.length) {
      const value = paragraph.join('\n');
      const match = /^\{\{(\w+)\}\}$/.exec(value);
      units.push({ id: match ? `input:${match[1]}` : null, text: value });
      paragraph = [];
    }
  };
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim() || /^#{1,6}\s/.test(line)) {
      flush();
    } else if (/^\s*[-*]\s/.test(line)) {
      flush();
      const match = /^- \[([IRW]\d{2})\] (.+)$/.exec(line);
      units.push({ id: match ? match[1] : null, text: line });
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return units;
}

function runAudit({ auditManifest = manifest } = {}) {
  const errors = [];
  const results = [];
  const ids = new Set();
  const expectedAgents = ['requirement-interpreter', 'adversarial-reviewer', 'final-review-writer'];
  if (Object.keys(auditManifest.agents).length !== expectedAgents.length
    || !expectedAgents.every(agent => Object.hasOwn(auditManifest.agents, agent))) {
    errors.push('The coverage map must include exactly the three runtime agents.');
  }
  if (new Set(contexts.map(context => context.id)).size !== contexts.length) {
    errors.push('Duplicate case context IDs.');
  }
  if (!checks.length || auditManifest.threshold < 0.9 || auditManifest.threshold > 1) {
    errors.push('Coverage checks and a threshold of at least 90% are required.');
  }
  for (const [file, expectedHash] of Object.entries(auditManifest.sourceHashes)) {
    if (hashFile(file) !== expectedHash) {
      errors.push(`Source fixture changed without refreshed gold: ${file}`);
    }
  }
  for (const check of checks) {
    if (ids.has(check.id)) {
      errors.push(`Duplicate check ID: ${check.id}`);
    }
    ids.add(check.id);
    const context = contexts.find(value => value.id === check.context);
    if (!context || !check.negatives.length) {
      errors.push(`Missing context or negative control: ${check.id}`);
      continue;
    }
    const result = {
      id: check.id, agent: context.agent, criterion: check.criterion,
      context: context.id, positiveAccepted: false, negatives: []
    };
    for (const quote of context.sourceQuotes || []) {
      if (!context.input.ticket.includes(quote)) {
        errors.push(`Gold source quote is absent: ${context.id}`);
      }
    }
    try {
      const raw = JSON.stringify(context.output);
      result.positiveAccepted = evaluateCriterion(
        check.criterion, context.agent, context.input, raw, context.gold
      );
      if (!evaluateCriterion('schemaConformance', context.agent, context.input, raw, context.gold)) {
        errors.push(`Positive control is not schema-valid: ${check.id}`);
      }
      for (const negative of check.negatives) {
        const output = JSON.parse(raw);
        if (negative.apply) {
          negative.apply(output);
        }
        const candidate = negative.raw === undefined ? JSON.stringify(output) : negative.raw;
        const actualSchemaValid = evaluateCriterion(
          'schemaConformance', context.agent, context.input, candidate, context.gold
        );
        const rejected = !evaluateCriterion(
          check.criterion, context.agent, context.input, candidate, context.gold
        );
        result.negatives.push({
          id: negative.id, rejected,
          expectedSchemaValid: negative.schemaValid, actualSchemaValid
        });
        if (actualSchemaValid !== negative.schemaValid) {
          errors.push(`Negative control schema expectation mismatch: ${check.id}/${negative.id}`);
        }
      }
    } catch (error) {
      errors.push(`${check.id}: ${error.message}`);
    }
    result.pass = result.positiveAccepted && result.negatives.length === check.negatives.length
      && result.negatives.every(item => item.rejected && item.actualSchemaValid === item.expectedSchemaValid);
    results.push(result);
  }

  const agents = {};
  for (const [agent, mapping] of Object.entries(auditManifest.agents)) {
    const prompt = fs.readFileSync(path.join(root, mapping.promptFile), 'utf8');
    const units = inventoryPrompt(prompt);
    if (hashFile(mapping.promptFile) !== mapping.promptSha256) {
      errors.push(`Prompt changed without a refreshed audit: ${mapping.promptFile}`);
    }
    const unitIds = units.map(unit => unit.id);
    if (new Set(unitIds.filter(Boolean)).size !== unitIds.filter(Boolean).length) {
      errors.push(`Duplicate prompt unit ID: ${agent}`);
    }
    for (const id of Object.keys(mapping.units)) {
      if (!unitIds.includes(id)) {
        errors.push(`Mapped instruction or input is absent: ${agent}/${id}`);
      }
    }
    const eligible = criterion => {
      const measured = results.filter(result => result.agent === agent && result.criterion === criterion);
      return measured.length > 0 && measured.every(result => result.pass);
    };
    const coverage = units.map(unit => ({
      ...unit,
      criteria: mapping.units[unit.id] || [],
      covered: Boolean(mapping.units[unit.id]?.length) && mapping.units[unit.id].every(eligible)
    }));
    if (mapping.runtimeSource) {
      const runtime = mapping.runtimeSource;
      if (hashFile(runtime.file) !== runtime.sha256) {
        errors.push(`Rendered-instruction source changed without a refreshed audit: ${runtime.file}`);
      }
      const source = fs.readFileSync(path.join(root, runtime.file), 'utf8');
      const example = contexts.find(context => context.id === 'redispatch');
      const rendered = buildPrompt(prompt, example.input);
      for (const unit of runtime.units) {
        const present = source.includes(unit.anchor) && rendered.includes(unit.anchor);
        coverage.push({
          id: unit.id, text: unit.anchor, criteria: unit.criteria,
          covered: present && unit.criteria.length > 0 && unit.criteria.every(eligible)
        });
      }
    }
    const mapped = coverage.filter(unit => unit.covered).length;
    if (mapped !== coverage.length) {
      errors.push(`Unmapped or unmeasured prompt units remain: ${agent}`);
    }
    agents[agent] = {
      examinerBaseline: mapping.examinerBaseline,
      mapped, total: coverage.length, coverage: coverage.length ? mapped / coverage.length : 0,
      unmapped: coverage.filter(unit => !unit.covered),
      units: coverage
    };
  }
  return {
    auditType: 'local-instruction-coverage-and-criterion-sensitivity',
    modelPerformanceMeasured: false,
    examinerParserEquivalent: false,
    scope: 'Deliverable 3 only; legacy scorer and historical metrics are unchanged.',
    threshold: auditManifest.threshold,
    hashNormalization: 'UTF-8 text, initial BOM removed, CRLF normalized to LF.',
    hashes: Object.fromEntries([
      'evals/load-bearing-map.json', 'evals/load-bearing-cases.js',
      'src/load-bearing-criteria.js', 'src/run-load-bearing-audit.js',
      'src/schema-validator.js', 'src/governance-policy.js', 'src/prompt-builder.js',
      'schemas/examiner.schema.json', 'schemas/challenges.schema.json',
      'schemas/final-review.schema.json',
      ...Object.values(auditManifest.agents).map(agent => agent.promptFile),
      ...Object.keys(auditManifest.sourceHashes)
    ].map(file => [file, hashFile(file)])),
    contexts: contexts.length,
    checks: results.length,
    negativeControls: results.reduce((sum, result) => sum + result.negatives.length, 0),
    pass: errors.length === 0 && results.every(result => result.pass)
      && Object.values(agents).every(agent => agent.coverage >= auditManifest.threshold),
    errors,
    agents,
    criterionChecks: results
  };
}

if (require.main === module) {
  const result = runAudit();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`${result.pass ? 'PASS' : 'FAIL'}: local instruction coverage and criterion sensitivity`);
    for (const [agent, data] of Object.entries(result.agents)) {
      console.log(`${agent}: ${data.mapped}/${data.total} = ${(data.coverage * 100).toFixed(1)}%`);
    }
    console.log(`${result.checks} positive controls; ${result.negativeControls} negative controls.`);
    console.log('Live-model performance not measured; examiner parser equivalence not established.');
    for (const error of result.errors) {
      console.error(error);
    }
    for (const check of result.criterionChecks.filter(check => !check.pass)) {
      console.error(JSON.stringify(check));
    }
  }
  if (!result.pass) {
    process.exitCode = 1;
  }
}

module.exports = { runAudit, inventoryPrompt };
