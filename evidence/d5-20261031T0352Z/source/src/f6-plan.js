const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cases } = require('../evals/step-cases');
const { iterations, revisePrompt } = require('../evals/f6-iterations');
const definitions = require('../evals/test-cases.json');
const registry = require('./agent-registry');
const { hash, inputHash, readJson } = require('./eval-evidence');
const { scorerHash } = require('./eval-runner');
const { runAudit } = require('./run-load-bearing-audit');
const { root, relative, filesIn, writeJson, snapshotSources } = require('./evidence-package');

function fixedCases() {
  const selected = cases.map(({ id, agent, input, gold }) => ({
    id, agent, input, gold, origin: 'evals/step-cases.js; pre-existing reviewed labels'
  }));
  const frozen = readJson(path.join(root, 'evidence/f3-20261030T2225Z/frozen-cases.json'));
  for (const id of ['ticket4-final-review-writer', 'ticket5-final-review-writer']) {
    const source = frozen.find(row => row.id === id);
    if (!source || source.before.inputHash !== inputHash(source.input)) {
      throw new Error(`Missing preserved writer input: ${id}`);
    }
    selected.push({
      id, agent: source.agent, input: source.input, gold: {},
      origin: `evidence/f3-20261030T2225Z/frozen-cases.json#${id}; exact upstream input, no inferred gold`
    });
  }
  return selected.map(row => ({ ...row, inputHash: inputHash(row.input), goldHash: inputHash(row.gold) }));
}

function prepare(directory) {
  directory = path.resolve(directory);
  const location = path.relative(path.join(root, 'evidence'), directory);
  if (!location || location.startsWith('..') || path.isAbsolute(location) || fs.existsSync(directory)) {
    throw new Error('Use a new directory inside evidence/; all existing attempts must remain untouched.');
  }
  const coverage = runAudit();
  if (!coverage.pass) throw new Error('Instruction coverage/sensitivity preflight failed.');
  const frozen = fixedCases();
  const preserved = execFileSync('git', ['ls-files', '-z', 'evidence'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean).map(file => ({
      file, sha256: hash(fs.readFileSync(path.join(root, file)))
    }));
  fs.mkdirSync(directory);
  const source = snapshotSources(directory);
  writeJson(path.join(directory, 'source-state.json'), source);
  writeJson(path.join(directory, 'preserved-evidence.json'), preserved);
  writeJson(path.join(directory, 'coverage.json'), coverage);
  writeJson(path.join(directory, 'frozen-cases.json'), frozen);
  const sourceHashes = filesIn(path.join(directory, 'source')).map(file => ({
    file: path.relative(path.join(directory, 'source'), file).split(path.sep).join('/'),
    sha256: hash(fs.readFileSync(file))
  }));
  const versions = iterations.map(iteration => {
    const prompts = {};
    for (const [agent, definition] of Object.entries(registry)) {
      const baseline = fs.readFileSync(path.join(root, definition.promptFile), 'utf8');
      const text = revisePrompt(baseline, agent, iteration.version);
      const file = path.join(directory, 'prompts', iteration.version, `${agent}.md`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, { flag: 'wx' });
      prompts[agent] = { file: relative(file), sha256: hash(text) };
    }
    return { ...iteration, prompts };
  });
  const plan = {
    version: 1, preparedAt: new Date().toISOString(), scope: 'F6a/F6b only',
    scorerHash: scorerHash(), casesHash: inputHash(frozen), sourceHashes, versions,
    casesPerVersion: frozen.length, maxModelInvocations: frozen.length * versions.length,
    modelSettings: { temperature: 0 }, providerRetries: 0,
    agents: Object.keys(registry),
    definitions: {
      ...definitions,
      promptComparison: { ...definitions.promptComparison, directory: relative(directory) }
    },
    design: 'Prospective v0 -> v1 -> v2 on identical fixed inputs; one observation per case/version, no repair, retry, or survivor selection.',
    decision: 'Report strict full-step, runtime-contract, gate, and criterion deltas, including zero/negative changes. A measured cycle is not necessarily an improvement. No automatic deployment.',
    limitations: [
      'Small development suite, not held-out evaluation; single observation per case/version.',
      'Temperature zero is not a reproducibility guarantee; no causal or statistical-significance claim.',
      'Corrected bounded scorer stays frozen; unsupported formulations may lack credit. No post-response label expansion.',
      'No workflow, F4, or overall certification PASS claim.'
    ]
  };
  writeJson(path.join(directory, 'collection-plan.json'), plan);
  return plan;
}

function verifyPlan(directory, { checkWorkingSource = false } = {}) {
  const plan = readJson(path.join(directory, 'collection-plan.json'));
  const frozen = readJson(path.join(directory, 'frozen-cases.json'));
  if (plan.version !== 1 || inputHash(frozen) !== plan.casesHash
    || plan.casesHash !== inputHash(fixedCases())
    || JSON.stringify(plan.versions.map(row => row.version)) !== JSON.stringify(iterations.map(row => row.version))
    || JSON.stringify(plan.agents) !== JSON.stringify(Object.keys(registry))
    || plan.maxModelInvocations !== frozen.length * iterations.length
    || new Set(frozen.map(row => row.id)).size !== frozen.length
    || frozen.some(row => inputHash(row.input) !== row.inputHash || inputHash(row.gold) !== row.goldHash)) {
    throw new Error('Frozen case/label identity mismatch.');
  }
  for (const entry of plan.sourceHashes) {
    const executable = /^(?:src\/|schemas\/|evals\/.*\.(?:js|json)$)/.test(entry.file);
    if (hash(fs.readFileSync(path.join(directory, 'source', entry.file))) !== entry.sha256
      || ((checkWorkingSource || executable)
        && hash(fs.readFileSync(path.join(root, entry.file))) !== entry.sha256)) {
      throw new Error(`Frozen source changed: ${entry.file}`);
    }
  }
  for (const version of plan.versions) {
    for (const [agent, prompt] of Object.entries(version.prompts)) {
      const baseline = fs.readFileSync(path.join(directory, 'source', registry[agent].promptFile), 'utf8');
      if (hash(fs.readFileSync(path.join(root, prompt.file))) !== prompt.sha256
        || hash(revisePrompt(baseline, agent, version.version)) !== prompt.sha256) {
        throw new Error('Versioned prompt changed.');
      }
    }
  }
  for (const entry of readJson(path.join(directory, 'preserved-evidence.json'))) {
    if (hash(fs.readFileSync(path.join(root, entry.file))) !== entry.sha256) {
      throw new Error(`Preserved evidence changed: ${entry.file}`);
    }
  }
  if (scorerHash() !== plan.scorerHash) throw new Error('Current scorer differs from the frozen F6 scorer.');
  return { plan, cases: frozen };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node src/f6-plan.js NEW_EVIDENCE_DIRECTORY');
    const plan = prepare(process.argv[2]);
    console.log(JSON.stringify({ prepared: true, cases: plan.casesPerVersion,
      maxModelInvocations: plan.maxModelInvocations }, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepare, verifyPlan, fixedCases };
