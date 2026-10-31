const fs = require('fs');
const path = require('path');
const registry = require('./agent-registry');
const { verifyPlan } = require('./f6-plan');
const { validateObservation, inputHash, hash, readJson, comparePaired } = require('./eval-evidence');
const { scoreStep, aggregate, VERSION } = require('./eval-scorer');
const { validateSchema } = require('./schema-validator');
const { validateInterpretationTransition, validateReview } = require('./governance-policy');
const { validateReport } = require('./report-contract');
const { root } = require('./evidence-package');
const { readBaseline } = require('./eval-runner');
const { workflowObservations } = require('./eval-evidence');

const identityFields = [
  'caseId', 'agent', 'inputHash', 'model', 'modelSettings', 'scorerHash',
  'schemaHash', 'governancePolicyHash', 'reportContractHash', 'goldHash'
];
const pairable = (before, after) => identityFields.every(field =>
  before[field] !== undefined && JSON.stringify(before[field]) === JSON.stringify(after[field]));

function runtimeStatus(agent, raw, input) {
  let output;
  try { output = JSON.parse(raw); } catch { return 'JSON_PARSE_FAILURE'; }
  if (!validateSchema(output, path.join(root, registry[agent].schemaFile)).valid) return 'SCHEMA_FAILURE';
  try {
    if (agent === 'requirement-interpreter') validateInterpretationTransition(output, input);
    else if (agent === 'adversarial-reviewer') validateReview(output, input);
    else validateReport(output, input);
    return 'SUCCESS';
  } catch (error) {
    return error.code || 'GOVERNANCE_FAILURE';
  }
}

function summarize(rows) {
  return {
    attempts: rows.length, rawResponses: rows.filter(row => row.rawAvailable).length,
    strictPasses: rows.filter(row => row.rawAvailable && row.score.pass).length,
    runtimeAccepted: rows.filter(row => row.runtimeStatus === 'SUCCESS').length,
    strictPassRate: rows.length ? rows.filter(row => row.rawAvailable && row.score.pass).length / rows.length : null,
    runtimeAcceptanceRate: rows.length ? rows.filter(row => row.runtimeStatus === 'SUCCESS').length / rows.length : null,
    gates: Object.fromEntries([...new Set(rows.flatMap(row => Object.keys(row.score.gates)))].map(name => [
      name, rows.filter(row => row.rawAvailable && row.score.gates[name]).length / rows.length
    ])),
    metrics: Object.values(aggregate(rows.map(row => row.score)))[0] || {}
  };
}

function analyzePackage(directory) {
  directory = path.resolve(directory);
  const { plan, cases } = verifyPlan(directory);
  const errors = [];
  const versions = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  for (const version of plan.versions) {
    const stage = path.join(directory, version.version);
    if (!fs.existsSync(path.join(stage, 'attempts.json'))) {
      errors.push(`${version.version}: incomplete or uncollected version; inspect retained started files/receipts.`);
      versions.push({ version: version.version, rows: [], agents: {}, collected: false });
      continue;
    }
    const attempts = readJson(path.join(stage, 'attempts.json'));
    const observations = readJson(path.join(stage, 'direct-responses.json')).observations;
    const audit = fs.readFileSync(path.join(stage, 'audit.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    check(attempts.attempts.length === cases.length && attempts.modelInvocations === cases.length,
      `${version.version}: incomplete invocation accounting.`);
    check(new Set(attempts.attempts.map(row => row.caseId)).size === cases.length
      && attempts.attempts.every(row => cases.some(value => value.id === row.caseId)),
    `${version.version}: unknown or duplicate attempts.`);
    check(new Set(observations.map(row => row.caseId)).size === observations.length
      && observations.every(row => cases.some(value => value.id === row.caseId)),
    `${version.version}: unknown or duplicate observations.`);
    check(audit.length === cases.length, `${version.version}: audit count mismatch.`);
    check(fs.readdirSync(path.join(stage, 'receipts')).length === cases.length * 2,
      `${version.version}: started/finished receipt count mismatch.`);
    const rows = [];
    for (const [index, testCase] of cases.entries()) {
      const attempt = attempts.attempts.find(row => row.caseId === testCase.id);
      if (!attempt) { errors.push(`${version.version}/${testCase.id}: missing attempt.`); continue; }
      const observation = observations.find(row => row.caseId === testCase.id);
      const base = path.join(root, attempt.runsDirectory, testCase.agent);
      const request = readJson(`${base}-request.json`);
      const prefix = `${version.version}/${testCase.id}`;
      const prompt = fs.readFileSync(`${base}-prompt.txt`, 'utf8');
      check(request.inputHash === testCase.inputHash
        && request.model === registry[testCase.agent].model
        && inputHash(request.modelSettings) === inputHash(plan.modelSettings)
        && request.runtimeMode === 'real' && request.correlationId === attempt.correlationId
        && inputHash(readJson(`${base}-input.json`)) === testCase.inputHash
        && request.promptHash === hash(prompt)
        && request.promptTemplateHash === version.prompts[testCase.agent].sha256,
      `${prefix}: persisted input/prompt/version mismatch.`);
      for (const [field, file] of [
        ['schemaHash', registry[testCase.agent].schemaFile],
        ['governancePolicyHash', 'src/governance-policy.js'],
        ['reportContractHash', 'src/report-contract.js']
      ]) check(request[field] === hash(fs.readFileSync(path.join(directory, 'source', file))),
        `${prefix}: frozen ${field} mismatch.`);
      const receipt = readJson(path.join(stage, 'receipts', `${index + 1}-finished.json`));
      const startedReceipt = readJson(path.join(stage, 'receipts', `${index + 1}-started.json`));
      check(receipt.promptHash === request.promptHash && receipt.model === request.model
        && receipt.temperature === plan.modelSettings.temperature && receipt.providerRetries === 0,
      `${prefix}: receipt identity mismatch.`);
      check(startedReceipt.status === 'REQUEST_STARTED' && startedReceipt.promptHash === receipt.promptHash
        && startedReceipt.sequence === receipt.sequence
        && Number.isFinite(Date.parse(receipt.startedAt)) && Number.isFinite(Date.parse(receipt.finishedAt)),
      `${prefix}: started/finished receipt mismatch.`);
      let raw = null;
      if (observation) {
        validateObservation(observation, testCase);
        raw = fs.readFileSync(`${base}-raw.txt`, 'utf8');
        check(raw === observation.rawResponse && receipt.rawHash === hash(raw)
          && observation.provenance.correlationId === attempt.correlationId,
        `${prefix}: raw/receipt identity mismatch.`);
      } else errors.push(`${prefix}: no model response; retained failure is not a paired observation.`);
      const status = raw === null ? attempt.status : runtimeStatus(testCase.agent, raw, testCase.input);
      check(status === attempt.status && audit.some(row => row.correlationId === attempt.correlationId
        && row.agent === testCase.agent && row.status === status), `${prefix}: runtime replay/audit mismatch.`);
      if (status === 'SUCCESS') check(inputHash(readJson(`${base}-validated.json`)) === inputHash(JSON.parse(raw)),
        `${prefix}: validated artifact mismatch.`);
      rows.push({
        caseId: testCase.id, agent: testCase.agent, inputHash: testCase.inputHash, goldHash: testCase.goldHash,
        model: request.model, modelSettings: request.modelSettings, scorerHash: plan.scorerHash,
        schemaHash: request.schemaHash, governancePolicyHash: request.governancePolicyHash,
        reportContractHash: request.reportContractHash, promptHash: request.promptHash,
        promptTemplateHash: request.promptTemplateHash, runtimeStatus: status, rawAvailable: raw !== null,
        rawArtifact: `${attempt.runsDirectory}/${testCase.agent}-raw.txt`,
        score: scoreStep(testCase.agent, raw === null ? 'null' : raw, testCase.input, testCase.gold)
      });
    }
    versions.push({
      version: version.version, collected: true, rows,
      agents: Object.fromEntries(plan.agents.map(agent => [agent, summarize(rows.filter(row => row.agent === agent))]))
    });
  }
  const cycles = [];
  for (let i = 1; i < versions.length; i++) {
    const before = versions[i - 1];
    const after = versions[i];
    const eligible = after.rows.filter(row => row.rawAvailable && before.rows.some(prior =>
      prior.rawAvailable && pairable(prior, row)));
    const comparison = comparePaired(before.rows.filter(row => row.rawAvailable), eligible);
    const unmatched = after.rows.filter(row => !eligible.includes(row)).map(row => row.caseId);
    check(comparison.pairs.length === cases.length, `${before.version}->${after.version}: incomplete strict pairing.`);
    cycles.push({
      before: before.version, after: after.version, comparison, unmatched,
      agents: Object.fromEntries(plan.agents.map(agent => {
        const a = before.agents[agent];
        const b = after.agents[agent];
        if (!a || !b) return [agent, { measured: false }];
        check(before.rows.find(row => row.agent === agent)?.promptTemplateHash
          !== after.rows.find(row => row.agent === agent)?.promptTemplateHash,
        `${agent}: unchanged template cannot count as a prompt-change cycle.`);
        const metrics = Object.fromEntries(Object.entries(b.metrics).map(([name, value]) => [
          name, { baseline: a.metrics[name]?.score ?? null, current: value.score,
            delta: a.metrics[name]?.applicable && value.applicable ? value.score - a.metrics[name].score : null }
        ]));
        const gates = Object.fromEntries(Object.entries(b.gates).map(([name, value]) => [
          name, { baseline: a.gates[name], current: value, delta: value - a.gates[name] }
        ]));
        return [agent, {
          measured: true, baseline: a, current: b, metrics, gates,
          strictPassDelta: b.strictPassRate - a.strictPassRate,
          runtimeAcceptanceDelta: b.runtimeAcceptanceRate - a.runtimeAcceptanceRate,
          anyPositiveDelta: Object.values(metrics).some(value => value.delta > 0)
            || Object.values(gates).some(value => value.delta > 0)
        }];
      }))
    });
  }
  const archival = plan.definitions.fixtures.filter(row => row.baseline.state === 'archival-incompatible').map(row => {
    const run = readBaseline(row.baseline);
    let incompatibility = null;
    try { workflowObservations(run, fs.readFileSync(path.join(root, row.fixture), 'utf8')); }
    catch (error) { incompatibility = error.message; }
    check(Boolean(incompatibility), `${row.fixture}: archival exclusion is not supported by an evidence-contract failure.`);
    return {
      fixture: row.fixture, file: row.baseline.file, reason: row.baseline.reason,
      sha256: hash(fs.readFileSync(path.join(root, row.baseline.file))),
      compatibility: 'excluded-incompatible', observedFailure: incompatibility
    };
  });
  const positiveCyclesPerAgent = Object.fromEntries(plan.agents.map(agent => [
    agent, cycles.filter(cycle => cycle.agents[agent]?.anyPositiveDelta).length
  ]));
  const latest = versions[versions.length - 1];
  return {
    scope: 'F6 measured prompt changes only; measurement integrity is separate from model acceptance.',
    scorerVersion: VERSION, scorerHash: plan.scorerHash, measurementPass: errors.length === 0,
    modelAcceptancePass: versions.length === 3 && latest.collected && latest.rows.length === cases.length
      && latest.rows.every(value => value.rawAvailable && value.score.pass),
    positiveCyclesPerAgent, errors, archival, versions, cycles, limitations: plan.limitations,
    allAttemptsRetained: true, productionPromptsAutomaticallyPromoted: false
  };
}

module.exports = { analyzePackage, pairable, summarize, runtimeStatus };
