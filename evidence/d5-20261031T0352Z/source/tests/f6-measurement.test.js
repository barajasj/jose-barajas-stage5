const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { cases } = require('../evals/step-cases');
const { revisePrompt } = require('../evals/f6-iterations');
const { prepare, verifyPlan } = require('../src/f6-plan');
const { collectVersion, main } = require('../src/collect-f6-evidence');
const { analyzePackage, pairable } = require('../src/f6-analysis');
const { main: replay } = require('../src/run-f6');
const { hash } = require('../src/eval-evidence');
const { reportTemplate } = require('../src/report-contract');
const { verifyPackage } = require('../src/evidence-package');

const root = path.resolve(__dirname, '..');
const clone = value => JSON.parse(JSON.stringify(value));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('F6 revisions are real cumulative template changes and leave the production template untouched', () => {
  for (const agent of ['requirement-interpreter', 'adversarial-reviewer', 'final-review-writer']) {
    const text = fs.readFileSync(path.join(root, 'agents', `${agent}.md`), 'utf8');
    const before = hash(text);
    assert.equal(revisePrompt(text, agent, 'v0'), text);
    const one = revisePrompt(text, agent, 'v1');
    const two = revisePrompt(text, agent, 'v2');
    assert.notEqual(hash(one), before);
    assert.notEqual(hash(two), hash(one));
    assert.ok(two.includes(one.split('## Measurement Revision v1\n\n')[1].split('\n\n## ')[0]));
    assert.equal(hash(fs.readFileSync(path.join(root, 'agents', `${agent}.md`))), before);
  }
  assert.throws(() => revisePrompt('text', 'requirement-interpreter', 'v3'), /Unknown/);
});

test('F6 strict pairing rejects changed contracts, labels, models, and incomplete identities', () => {
  const row = {
    caseId: 'case', agent: 'agent', inputHash: 'input', model: 'model',
    modelSettings: { temperature: 0 }, scorerHash: 'scorer',
    schemaHash: 'schema', governancePolicyHash: 'policy', reportContractHash: 'report', goldHash: 'gold'
  };
  assert.equal(pairable(row, { ...row, promptHash: 'changed-prompt' }), true);
  for (const field of Object.keys(row)) {
    assert.equal(pairable(row, { ...row, [field]: 'changed' }), false, field);
    const missing = clone(row);
    delete missing[field];
    assert.equal(pairable(missing, missing), false, field);
  }
});

test('F6 network collection requires explicit opt-in', async () => {
  await assert.rejects(main([]), /--allow-live/);
  await assert.rejects(main(['evidence/unused', 'v0']), /--allow-live/);
});

test('F6 offline synthetic replay counts failures, prevents reruns, pairs two changes, and detects mutation', async t => {
  // Stub outputs test the harness only; this package is deleted and is never model evidence.
  const directory = path.join(root, 'evidence', `f6-test-${randomUUID()}`);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const plan = prepare(directory);
  assert.equal(plan.maxModelInvocations, 84);
  assert.equal(plan.casesPerVersion, 28);
  assert.throws(() => prepare(directory), /existing attempts/);
  const frozen = readJson(path.join(directory, 'frozen-cases.json'));
  let calls = 0;
  const collect = version => collectVersion({
    directory, version, progress: () => {},
    invokeModel: async request => {
      const index = calls++ % frozen.length;
      const context = frozen[index];
      assert.equal(request.temperature, 0);
      assert.ok(request.prompt.includes(`Measurement Revision ${version}`) || version === 'v0');
      if (version === 'v0' && index === 0) return { content: 'not JSON' };
      const output = cases.find(row => row.id === context.id)?.output
        || { reportMarkdown: reportTemplate(context.input) };
      return { content: JSON.stringify(output), promptTokens: 1, completionTokens: 2, totalTokens: 3 };
    }
  });
  await assert.rejects(collect('v1'), /predecessor/);
  await collect('v0');
  await assert.rejects(collect('v0'), /already attempted/);
  await collect('v1');
  await collect('v2');
  assert.equal(calls, 84);
  assert.equal(verifyPlan(directory).cases.length, 28);
  const result = analyzePackage(directory);
  assert.equal(result.measurementPass, true, result.errors.join('\n'));
  assert.equal(result.modelAcceptancePass, true);
  assert.equal(result.versions[0].agents['requirement-interpreter'].attempts, 8);
  assert.equal(result.versions[0].agents['requirement-interpreter'].strictPasses, 7);
  assert.equal(result.versions[1].agents['requirement-interpreter'].strictPasses, 8);
  assert.equal(result.cycles.length, 2);
  assert.ok(result.cycles.every(row => row.comparison.pairs.length === 28 && row.unmatched.length === 0));
  assert.equal(result.cycles[0].agents['requirement-interpreter'].strictPassDelta, 1 / 8);
  assert.equal(result.cycles[1].agents['requirement-interpreter'].strictPassDelta, 0);
  assert.equal(result.archival.length, 3);
  const savedLog = console.log;
  console.log = () => {};
  try {
    replay([directory, '--write']);
    assert.equal(verifyPackage(directory).pass, true);
    replay([directory]);
    assert.throws(() => replay([directory, '--write']), /already exists/);
  } finally { console.log = savedLog; }
  const first = readJson(path.join(directory, 'v0/attempts.json')).attempts[0];
  const rawFile = path.join(root, first.runsDirectory, `${first.agent}-raw.txt`);
  fs.appendFileSync(rawFile, ' tampered');
  assert.equal(analyzePackage(directory).measurementPass, false);
  assert.equal(verifyPackage(directory).pass, false);
});

test('F6 transport failures remain discoverable and cannot become compatible baseline observations', async t => {
  const directory = path.join(root, 'evidence', `f6-test-${randomUUID()}`);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  prepare(directory);
  let calls = 0;
  await collectVersion({
    directory, version: 'v0', progress: () => {},
    invokeModel: async () => {
      if (calls++ === 0) throw new Error('Synthetic transport failure');
      return { content: 'invalid JSON' };
    }
  });
  const result = analyzePackage(directory);
  assert.equal(calls, 28);
  assert.equal(result.measurementPass, false);
  assert.ok(result.errors.some(value => value.includes('no model response')));
  const attempts = readJson(path.join(directory, 'v0/attempts.json')).attempts;
  assert.equal(attempts[0].status, 'MODEL_FAILURE');
  assert.equal(attempts[0].hasRawResponse, false);
  assert.equal(result.versions[0].agents['requirement-interpreter'].attempts, 8);
  assert.equal(result.versions[0].agents['requirement-interpreter'].rawResponses, 7);
  assert.equal(result.cycles[0].comparison.pairs.length, 0);
  assert.equal(readJson(path.join(directory, 'v0/receipts/1-finished.json')).status, 'MODEL_FAILURE');
});
