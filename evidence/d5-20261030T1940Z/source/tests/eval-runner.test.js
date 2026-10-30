const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { cases } = require('../evals/step-cases');
const definitions = require('../evals/test-cases.json');
const { runEvaluation, evaluateDirect, readBaseline, evaluateWorkflow } = require('../src/eval-runner');
const { hash, inputHash, validateObservation, workflowObservations, comparePaired } = require('../src/eval-evidence');
const { scoreStep, metric } = require('../src/eval-scorer');
const { createAgentRunner } = require('../src/agent-runner');
const { executeWorkflow } = require('../src/coordinator');

const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const context = id => cases.find(value => value.id === id);
const coverage = { pass: true, agents: {}, errors: [] };

function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage5-evals-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

// Synthetic provenance tests validation only; these fixtures are never exported as model evidence.
function observation(testCase) {
  const rawResponse = JSON.stringify(testCase.output);
  return {
    caseId: testCase.id, agent: testCase.agent, input: clone(testCase.input), rawResponse,
    provenance: {
      runtimeMode: 'real', model: 'test-stub', modelSettings: { temperature: 0 },
      inputHash: inputHash(testCase.input), rawHash: hash(rawResponse), promptHash: hash('test-prompt'),
      schemaHash: hash('test-schema'), correlationId: 'TEST-ONLY', timestamp: '2026-10-30T12:00:00Z'
    }
  };
}

function cli(args) {
  return spawnSync(process.execPath, [path.join(root, 'src/run-evals.js'), ...args],
    { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}

test('authored controls are explicitly labeled and never reported as model performance', () => {
  const result = runEvaluation({ selfTest: true, coverage });
  assert.equal(result.pass, true);
  assert.equal(result.direct.length, 26);
  assert.equal(result.mode, 'authored-controls');
  assert.equal(result.modelPerformanceMeasured, false);
  assert.equal(result.comparisons.pairs.length, 0);
});

test('direct evidence requires every fixed case and rejects duplicates, unknown IDs, mock mode, and mismatched inputs', () => {
  const responses = { observations: cases.map(observation) };
  assert.equal(evaluateDirect(responses, hash('scorer')).errors.length, 0);
  for (const mutate of [
    data => { data.observations.pop(); },
    data => { data.observations.push(clone(data.observations[0])); },
    data => { data.observations[0].caseId = 'UNKNOWN'; },
    data => { data.observations[0].provenance.runtimeMode = 'mock'; },
    data => { data.observations[0].input.ticket = 'Different ticket'; },
    data => { data.observations[0].rawResponse += ' '; },
    data => { delete data.observations[0].provenance.promptHash; },
    data => { delete data.observations[0].rawResponse; }
  ]) {
    const changed = clone(responses);
    mutate(changed);
    assert.ok(evaluateDirect(changed, hash('scorer')).errors.length > 0);
  }
  const missing = observation(context('clean-review'));
  delete missing.provenance;
  assert.throws(() => validateObservation(missing, context('clean-review')), /real mode/);
});

test('unknown gold contexts are configuration failures, never inferred from candidate output', () => {
  const testCase = context('missing');
  assert.throws(() => scoreStep(testCase.agent, testCase.output, testCase.input, {}), /labels/);
  assert.throws(() => workflowObservations({ disposition: 'PASS' }, 'ticket'), /completed status/);
});

test('required missing/corrupt baselines fail; intentional post-baseline fixture absence is explicit', t => {
  const directory = workspace(t);
  const corrupt = path.join(directory, 'corrupt.json');
  fs.writeFileSync(corrupt, '{broken');
  assert.throws(() => readBaseline({ state: 'required', file: path.join(directory, 'missing.json') }), /ENOENT/);
  assert.throws(() => readBaseline({ state: 'required', file: corrupt }), SyntaxError);
  assert.throws(() => readBaseline({ state: 'not-in-baseline' }), /reason/);
  assert.equal(readBaseline({ state: 'not-in-baseline', reason: 'New fixture.' }), null);
  assert.equal(definitions.fixtures[3].baseline.state, 'not-in-baseline');
});

test('paired deltas require identical case, input, model, settings, and scorer; expanded cases stay separate', () => {
  const row = {
    caseId: 'ticket-1', agent: 'requirement-interpreter', inputHash: hash('fixed input'),
    model: 'model-A', modelSettings: { temperature: 0 }, scorerHash: hash('scorer'),
    score: { metrics: { accuracy: metric([true, false]) } }
  };
  const current = { ...clone(row), score: { metrics: { accuracy: metric([true, true]) } } };
  const paired = comparePaired([row], [current, { ...clone(current), caseId: 'ticket-4' }]);
  assert.equal(paired.pairs.length, 1);
  assert.equal(paired.pairs[0].metrics.accuracy.delta, 0.5);
  assert.equal(paired.unpaired[0].caseId, 'ticket-4');
  for (const mutation of [
    { caseId: 'other-case' }, { inputHash: hash('other-input') }, { model: 'model-B' },
    { modelSettings: { temperature: 1 } }, { scorerHash: hash('other-scorer') }
  ]) assert.equal(comparePaired([row], [{ ...current, ...mutation }]).pairs.length, 0);
});

test('complete persisted workflow can be scored; missing/mutated provenance never becomes a clean review', async t => {
  const directory = workspace(t);
  const clean = context('clean');
  const review = context('clean-review');
  const assessmentFile = path.join(directory, 'assessment.json');
  fs.writeFileSync(assessmentFile, JSON.stringify({ overallAssessment: { humanReviewRequired: false } }));
  const outputs = [clean.output, review.output, context('writer-pass').output];
  const agentRunner = createAgentRunner({ invokeModel: async () => ({ content: JSON.stringify(outputs.shift()) }) });
  const options = {
    runtimeMode: 'real', runsDir: path.join(directory, 'runs'), auditFile: path.join(directory, 'audit.jsonl'),
    assessmentFile, decisionsFile: path.join(directory, 'decisions.jsonl'), agentRunner
  };
  const run = await executeWorkflow(clean.input.ticket, options);
  assert.equal(run.status, 'COMPLETED');
  assert.equal(workflowObservations(run, clean.input.ticket).length, 3);
  assert.equal(evaluateWorkflow(run, clean.input.ticket, 'positive-control', hash('scorer')).every(row => row.score.pass), true);
  const ticketFile = path.join(directory, 'positive-control.md');
  const runFile = path.join(directory, 'positive-control.json');
  fs.writeFileSync(ticketFile, clean.input.ticket);
  fs.writeFileSync(runFile, JSON.stringify(run));
  const complete = runEvaluation({
    responses: { observations: cases.map(observation) }, coverage,
    definitions: {
      ...definitions,
      fixtures: [{ fixture: ticketFile, evidenceFile: runFile,
        baseline: { state: 'not-in-baseline', reason: 'New synthetic positive-control fixture.' } }]
    }
  });
  assert.equal(complete.pass, true, complete.errors.join('\n'));
  assert.equal(complete.workflows[0].rows.length, 3);
  for (const mutate of [
    changed => { delete changed.finalReviewResult; },
    changed => { changed.reviewCycles[0].reviewResult.output.findings = []; changed.reviewCycles[0].reviewResult.output.status = 'FAIL'; },
    changed => { changed.runtimeMode = 'mock'; },
    changed => { changed.reviewCycles[0].cycle = 2; },
    changed => { changed.disposition = 'FAIL'; },
    changed => { changed.reviewCycles[0].interpreterResult.audit.inputHash = hash('different-input'); }
  ]) {
    const changed = clone(run);
    mutate(changed);
    assert.throws(() => workflowObservations(changed, clean.input.ticket));
  }
  const promptFile = path.join(options.runsDir, run.correlationId, 'cycle-1/adversarial-reviewer-prompt.txt');
  fs.appendFileSync(promptFile, '\nAltered prompt.');
  assert.throws(() => workflowObservations(run, clean.input.ticket), /mismatch/);
});

test('CLI exits zero for authored controls and nonzero for missing model evidence without rewriting history', () => {
  const historicPath = path.join(root, 'sub-agents-results.json');
  const before = hash(fs.readFileSync(historicPath));
  const controls = cli(['--self-test']);
  assert.equal(controls.status, 0, controls.stderr);
  assert.equal(JSON.parse(controls.stdout).modelPerformanceMeasured, false);
  const evidence = cli([]);
  assert.equal(evidence.status, 1, evidence.stderr);
  const result = JSON.parse(evidence.stdout);
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(error => error.includes('Missing required direct response')));
  assert.ok(result.workflows.every(value => value.failure));
  assert.equal(hash(fs.readFileSync(historicPath)), before);
});

test('CLI rejects corrupt inputs, mixed control/model mode, bad flags, and output overwrites', t => {
  const directory = workspace(t);
  const invalid = path.join(directory, 'invalid.json');
  fs.writeFileSync(invalid, '{broken');
  for (const args of [
    ['--responses', invalid], ['--unknown'], ['--responses'],
    ['--self-test', '--responses', path.join(root, 'evals/test-cases.json')],
    ['--self-test', '--output', path.join(root, 'sub-agents-results.json')],
    ['--self-test', '--output', invalid]
  ]) assert.equal(cli(args).status, 1, args.join(' '));
});

test('CLI failure exit is triggered by content/threshold misses, not just missing evidence', t => {
  const directory = workspace(t);
  const file = path.join(directory, 'responses.json');
  const responses = { observations: cases.map(observation) };
  const candidate = responses.observations.find(value => value.caseId === 'missing');
  const output = JSON.parse(candidate.rawResponse);
  output.findings[0].action = 'Fix it.';
  candidate.rawResponse = JSON.stringify(output);
  candidate.provenance.rawHash = hash(candidate.rawResponse);
  fs.writeFileSync(file, JSON.stringify(responses));
  const result = cli(['--responses', file]);
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(report.failures.some(failure => failure.caseId === 'missing' && failure.criteria.includes('missingRequirementDetection')));
});

test('missing coverage and absent mandatory applicability fail the runner', () => {
  assert.equal(runEvaluation({ selfTest: true, coverage: { pass: false, agents: {}, errors: ['unmapped'] } }).pass, false);
  assert.throws(() => runEvaluation({ selfTest: true, definitions: { version: 2, directCases: 'evals/step-cases.js', fixtures: [] }, coverage }),
    /fixtures/);
});
