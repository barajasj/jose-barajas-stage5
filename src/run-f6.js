const fs = require('fs');
const path = require('path');
const { analyzePackage } = require('./f6-analysis');
const { runEvaluation } = require('./eval-runner');
const { runAudit } = require('./run-load-bearing-audit');
const { readJson } = require('./eval-evidence');
const { root, relative, writeJson, sealPackage, verifyPackage } = require('./evidence-package');

const percent = value => value === null || value === undefined ? 'NA' : `${(value * 100).toFixed(1)}%`;
const delta = value => value === null || value === undefined ? 'NA' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;

function renderReport(result, directory) {
  const location = relative(directory);
  const lines = [
    '# F6 Baseline Comparison And Measured Results',
    '',
    `Measurement integrity: ${result.measurementPass ? 'PASS' : 'FAIL'}. Latest-candidate strict model acceptance: ${result.modelAcceptancePass ? 'PASS' : 'FAIL'}.`,
    '',
    'These are prospective, paired prompt-version observations, not reconstructed historical improvements. A valid measurement trail does not establish that a prompt change improved performance.',
    '',
    '## Improvement Table',
    '',
    '| Agent | Cycle | Strict Before | Strict After | Strict Delta | Runtime Before | Runtime After | Runtime Delta | Any Positive Criterion/Gate Delta |',
    '|---|---|---:|---:|---:|---:|---:|---:|---|'
  ];
  for (const cycle of result.cycles) {
    for (const [agent, row] of Object.entries(cycle.agents)) {
      lines.push(`| ${agent} | ${cycle.before}->${cycle.after} | ${percent(row.baseline?.strictPassRate)} | ${percent(row.current?.strictPassRate)} | ${delta(row.strictPassDelta)} | ${percent(row.baseline?.runtimeAcceptanceRate)} | ${percent(row.current?.runtimeAcceptanceRate)} | ${delta(row.runtimeAcceptanceDelta)} | ${row.measured ? row.anyPositiveDelta : 'unmeasured'} |`);
    }
  }
  lines.push('', '## Baseline Validity', '',
    'Eligible baselines are fresh v0 observations; v1 is the baseline for cycle 2. Each pair requires identical case, agent, input, model/settings, schema, runtime contracts, labels, and scorer. Prompt templates must differ. Failed raw generations remain eligible negative observations; missing raw responses cannot form a pair.',
    '', '| Archival File | Original SHA-256 | Exclusion Observed |', '|---|---|---|');
  for (const row of result.archival) lines.push(`| ${row.file} | ${row.sha256} | ${row.observedFailure} |`);
  for (const cycle of result.cycles) lines.push('',
    `${cycle.before}->${cycle.after}: ${cycle.comparison.pairs.length} eligible pairs; unmatched current: ${JSON.stringify(cycle.unmatched)}; baseline-only: ${JSON.stringify(cycle.comparison.baselineOnly)}.`);
  lines.push('', '## Version Ledger', '',
    '| Version | Reason/Hypothesis | Prompt Evidence | Measurements |', '|---|---|---|---|');
  const plan = readJson(path.join(directory, 'collection-plan.json'));
  for (const version of plan.versions) {
    lines.push(`| ${version.version} | ${version.reason} | ${location}/prompts/${version.version}/; SHA-256 and exact added instructions in collection-plan.json | measured-results.json#versions/${version.version}; ${version.version}/attempts.json |`);
  }
  lines.push('', '## Reproduction', '', '```text',
    `node src/run-f6.js ${location}`,
    `node src/evidence-package.js ${location}`,
    'npm test',
    'npm run eval:controls',
    'npm run eval:coverage',
    '```', '',
    'Offline replay revalidates original raw/input/prompt/request/validated artifacts, audit outcomes, receipts, frozen scorer/labels, strict pair identities, and hashes of all tracked historical evidence. No API calls or response repair occur during replay.',
    '',
    'Fresh collection uses a NEW directory, then v0, v1, v2 in order. It requires explicit network authorization:',
    '', '```text',
    'node src/f6-plan.js evidence/NEW-F6-PACKAGE',
    'node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v0 --allow-live',
    'node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v1 --allow-live',
    'node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v2 --allow-live',
    'node src/run-f6.js evidence/NEW-F6-PACKAGE --write',
    '```', '', '## Limitations And Blockers', '',
    ...result.limitations.map(text => `- ${text}`),
    '- All attempts count. Runtime acceptance, exact-label scoring, and workflow completion are different measurements.',
    '- Positive metric/gate changes are descriptive, not statistical proof; mixed or zero changes are not labeled improvements.',
    '- Existing workflow and semantic acceptance failures remain reported separately; this stream does not remediate them.',
    ...result.errors.map(text => `- Measurement blocker: ${text}`),
    '', `Full metrics, per-case deltas, gates, unmatched identities, raw artifact paths, and negative changes: ${location}/measured-results.json.`,
    `Fresh evaluator replay (including preserved workflow failures): ${location}/evaluations/; fresh coverage/sensitivity: ${location}/fresh-coverage.json.`,
    '', 'No production prompt is promoted automatically; versioned candidates remain reviewable.', ''
  );
  return lines.join('\n');
}

function main(argv = process.argv.slice(2)) {
  if (![1, 2].includes(argv.length) || (argv[1] && argv[1] !== '--write')) {
    throw new Error('Usage: node src/run-f6.js DIRECTORY [--write]');
  }
  const directory = path.resolve(argv[0]);
  const result = analyzePackage(directory);
  if (argv[1] === '--write') {
    if (fs.existsSync(path.join(directory, 'measured-results.json'))
      || fs.existsSync(path.join(directory, 'manifest.json'))) throw new Error('Report/seal already exists; never overwrite evidence.');
    const plan = readJson(path.join(directory, 'collection-plan.json'));
    const coverage = runAudit();
    writeJson(path.join(directory, 'fresh-coverage.json'), coverage);
    fs.mkdirSync(path.join(directory, 'evaluations'));
    const allowed = new Set(require('../evals/step-cases').cases.map(row => row.id));
    const responses = version => ({
      observations: readJson(path.join(directory, version, 'direct-responses.json')).observations
        .filter(row => allowed.has(row.caseId))
    });
    for (const [index, version] of plan.versions.entries()) {
      const evaluated = runEvaluation({
        responses: responses(version.version), coverage, definitions: plan.definitions,
        ...(index ? { baselineResponses: responses(plan.versions[index - 1].version) } : {})
      });
      writeJson(path.join(directory, 'evaluations', `${version.version}.json`), evaluated);
    }
    writeJson(path.join(directory, 'measured-results.json'), result);
    fs.writeFileSync(path.join(directory, 'F6-REPORT.md'), renderReport(result, directory), { flag: 'wx' });
    sealPackage(directory, {
      scope: 'F6', measurementPass: result.measurementPass,
      plannedModelInvocations: plan.maxModelInvocations,
      allAttemptsRetained: true
    });
  } else {
    const saved = path.join(directory, 'measured-results.json');
    if (fs.existsSync(saved) && JSON.stringify(readJson(saved)) !== JSON.stringify(result)) {
      throw new Error('Recomputed F6 measurements differ from the preserved report.');
    }
    if (fs.existsSync(path.join(directory, 'manifest.json')) && !verifyPackage(directory).pass) {
      throw new Error('Evidence package seal failed.');
    }
  }
  console.log(JSON.stringify({
    measurementPass: result.measurementPass, modelAcceptancePass: result.modelAcceptancePass,
    versions: result.versions.map(row => ({ version: row.version, agents: row.agents })),
    positiveCyclesPerAgent: result.positiveCyclesPerAgent, errors: result.errors
  }, null, 2));
  if (!result.measurementPass) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { main, renderReport };
