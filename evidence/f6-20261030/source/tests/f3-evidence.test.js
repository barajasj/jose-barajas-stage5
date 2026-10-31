const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { rates, pairedIdentity, comparison, collectF3, main } = require('../src/collect-f3-evidence');
const { verifyPackage } = require('../src/evidence-package');

const root = path.resolve(__dirname, '..');
const historical = path.join(root, 'evidence/d5-20261030T1940Z');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

test('F3 rates include all failures and distinguish completed FAIL reports from aborts', () => {
  assert.deepEqual(rates([{ status: 'SUCCESS' }, { status: 'MODEL_FAILURE' }]), {
    attempts: 2, successes: 1, failures: 1, completionRate: 0.5, failureRate: 0.5
  });
  assert.equal(rates([]).completionRate, null);
  const groups = comparison([], [], [
    { run: { correlationId: 'old', status: 'GOVERNANCE_FAILURE' } }
  ], [
    { correlationId: 'new', status: 'COMPLETED', disposition: 'FAIL' }
  ], [
    { correlationId: 'old', agent: 'final-review-writer', status: 'GOVERNANCE_FAILURE' }
  ], [
    { correlationId: 'new', agent: 'final-review-writer', status: 'SUCCESS' },
    { correlationId: 'unrelated', agent: 'final-review-writer', status: 'SUCCESS' }
  ]);
  assert.equal(groups.workflows.after.completionRate, 1);
  assert.equal(groups.workflowWriters.before.failureRate, 1);
  assert.equal(groups.workflowWriters.after.attempts, 1);
  assert.equal(groups.workflowReviewers.after.completionRate, null);
});

test('F3 direct pairing requires identical inputs, models, settings, schemas, and runtime contracts', () => {
  const before = {
    inputHash: 'input', model: 'model', modelSettings: { temperature: 0 },
    schemaHash: 'schema', governancePolicyHash: 'policy', reportContractHash: 'report',
    promptHash: 'old-prompt'
  };
  assert.equal(pairedIdentity(before, { ...before, promptHash: 'new-prompt' }), true);
  for (const field of Object.keys(before).filter(field => field !== 'promptHash')) {
    assert.equal(pairedIdentity(before, { ...before, [field]: 'changed' }), false);
  }
  assert.equal(pairedIdentity({}, {}), false);
  assert.equal(pairedIdentity(before, undefined), false);
});

test('F3 collector refuses unapproved live calls and existing directories before invocation', async () => {
  await assert.rejects(main([]), /--allow-live/);
  let called = false;
  await assert.rejects(collectF3({
    directory: historical, invokeModel: async () => { called = true; }
  }), /existing packages cannot be overwritten/);
  assert.equal(called, false);
});

test('F3 offline collector replay retains every failed attempt and seals complete evidence', async t => {
  const directory = path.join(root, 'evidence', `f3-test-${randomUUID()}`);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const direct = readJson(path.join(historical, 'direct-responses.json')).observations;
  const workflows = readJson(path.join(historical, 'collection-summary.json')).workflows;
  const queue = direct.filter(row => row.agent === 'adversarial-reviewer').map(row => row.rawResponse);
  const step = (workflow, agent, cycle = 1) => fs.readFileSync(path.join(historical, 'runs',
    workflow.correlationId, `cycle-${cycle}`, `${agent}-raw.txt`), 'utf8');
  queue.push(step(workflows[1], 'adversarial-reviewer'), step(workflows[2], 'adversarial-reviewer'),
    step(workflows[3], 'final-review-writer'), step(workflows[4], 'final-review-writer'));
  const beforeAudit = fs.readFileSync(path.join(historical, 'audit.jsonl'), 'utf8')
    .trim().split('\n').map(JSON.parse);
  for (const workflow of workflows) {
    for (const entry of beforeAudit.filter(row => row.correlationId === workflow.correlationId
      && ['requirement-interpreter', 'adversarial-reviewer', 'final-review-writer'].includes(row.agent))) {
      queue.push(step(workflow, entry.agent, entry.cycle));
    }
  }
  const expectedCalls = queue.length;
  const summary = await collectF3({
    directory, progress: () => {},
    invokeModel: async () => {
      assert.ok(queue.length, 'Unexpected invocation');
      return { content: queue.shift(), promptTokens: 5, completionTokens: 6, totalTokens: 11 };
    }
  });
  assert.equal(queue.length, 0);
  assert.equal(summary.modelInvocations, expectedCalls);
  assert.equal(summary.attempts.length, 20);
  assert.equal(summary.workflows.length, 5);
  assert.equal(summary.groups.directReviewer.after.successes, 11);
  assert.equal(summary.groups.frozenReviewer.after.failures, 2);
  assert.equal(summary.groups.frozenWriter.after.failures, 2);
  assert.equal(summary.groups.workflows.after.successes, 1);
  assert.equal(summary.groups.workflowWriters.after.attempts, 3);
  assert.equal(summary.groups.workflowWriters.after.failures, 2);
  assert.equal(summary.tokens.total, expectedCalls * 11);
  assert.equal(readJson(path.join(directory, 'direct-responses.json')).observations.length, 20);
  assert.equal(fs.readdirSync(path.join(directory, 'receipts')).length, expectedCalls);
  assert.equal(verifyPackage(directory).pass, true);
});
