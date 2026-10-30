const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAgentRunner } = require('../src/agent-runner');
const { validateSchema } = require('../src/schema-validator');
const { validateReview } = require('../src/governance-policy');
const { reportTemplate } = require('../src/report-contract');

const root = path.resolve(__dirname, '..');
const historical = path.join(root, 'evidence/d5-20261030T1940Z');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const workflows = readJson(path.join(historical, 'collection-summary.json')).workflows;

function frozenStep(ticket, agent) {
  const workflow = workflows[ticket - 1];
  const base = path.join(historical, 'runs', workflow.correlationId, 'cycle-1', agent);
  return {
    input: readJson(`${base}-input.json`),
    raw: fs.readFileSync(`${base}-raw.txt`, 'utf8')
  };
}

async function replay(t, agent, input, raw, expectedFailure) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage5-f3-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const auditFile = path.join(directory, 'audit.jsonl');
  const runner = createAgentRunner({ invokeModel: async () => ({ content: raw }) });
  const invoke = () => runner(agent, input, 'F3-regression', {
    runtimeMode: 'real', runsDir: directory, auditFile
  });
  if (expectedFailure) {
    await assert.rejects(invoke(), error => error.code === expectedFailure);
  } else {
    await invoke();
  }
  const base = path.join(directory, 'F3-regression', 'cycle-1', agent);
  assert.equal(fs.readFileSync(`${base}-raw.txt`, 'utf8'), raw);
  assert.equal(fs.existsSync(`${base}-input.json`), true);
  assert.equal(fs.existsSync(`${base}-prompt.txt`), true);
  if (agent === 'adversarial-reviewer') {
    const prompt = fs.readFileSync(`${base}-prompt.txt`, 'utf8').replace(/\r\n/g, '\n');
    assert.deepEqual(JSON.parse(prompt.split('## Required Output JSON Schema\n\n')[1]),
      readJson(path.join(root, 'schemas/challenges.schema.json')));
  }
  assert.equal(fs.existsSync(`${base}-parsed.json`), true);
  assert.equal(fs.existsSync(`${base}-validated.json`), !expectedFailure);
  const entries = fs.readFileSync(auditFile, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(entries.at(-1).status, expectedFailure || 'SUCCESS');
  if (!expectedFailure) {
    assert.deepEqual(readJson(`${base}-validated.json`), JSON.parse(raw));
  }
}

test('F3 historical missing fields and invalid citations remain rejected without repair', async t => {
  for (const [ticket, status] of [[2, 'SCHEMA_FAILURE'], [3, 'GOVERNANCE_FAILURE']]) {
    const { input, raw } = frozenStep(ticket, 'adversarial-reviewer');
    await replay(t, 'adversarial-reviewer', input, raw, status);
  }
  const observations = readJson(path.join(historical, 'direct-responses.json')).observations;
  for (const id of ['hvac', 'validation', 'resolved', 'bad-resolution']) {
    const observation = observations.find(row => row.caseId === id);
    await replay(t, observation.agent, observation.input, observation.rawResponse,
      'GOVERNANCE_FAILURE');
  }
});

test('F3 worked reviewer finding accepts exact scalar citations and rejects observed deviations', async t => {
  const prompt = fs.readFileSync(path.join(root, 'agents/adversarial-reviewer.md'), 'utf8');
  const input = JSON.parse(/Example input: `([^`]+)`/.exec(prompt)[1]);
  const finding = JSON.parse(/Complete finding: `([^`]+)`/.exec(prompt)[1]);
  const output = {
    status: 'FAIL', rationale: finding.description, findings: [finding], resolutions: []
  };
  assert.equal(validateSchema(output, 'schemas/challenges.schema.json').valid, true);
  assert.doesNotThrow(() => validateReview(output, input));
  await replay(t, 'adversarial-reviewer', input, JSON.stringify(output));
  for (const [mutate, status] of [
    [value => { delete value.findings[0].ambiguityRefs; }, 'SCHEMA_FAILURE'],
    [value => { value.findings[0].sourceRefs[1].pointer = '/businessRules'; }, 'GOVERNANCE_FAILURE'],
    [value => { value.findings[0].sourceRefs[1].pointer = ''; }, 'GOVERNANCE_FAILURE'],
    [value => { value.findings[0].sourceRefs[1].pointer = '/businessRules/0'; }, 'GOVERNANCE_FAILURE'],
    [value => { value.findings[0].sourceRefs[1].quote = 'Round the sum to the nearest-inch.'; },
      'GOVERNANCE_FAILURE'],
    [value => { value.findings[0].sourceRefs[1].artifact = 'ticket';
      value.findings[0].sourceRefs[1].pointer = ''; }, 'GOVERNANCE_FAILURE']
  ]) {
    const changed = structuredClone(output);
    mutate(changed);
    await replay(t, 'adversarial-reviewer', input, JSON.stringify(changed), status);
  }
});

test('F3 writer examples round-trip nested escapes and preserve source wording', () => {
  const prompt = fs.readFileSync(path.join(root, 'agents/final-review-writer.md'), 'utf8');
  const examples = [...prompt.matchAll(
    /Template fragment: `([^`]+)`\. Correct JSON fragment: `([^`]+)`/g
  )];
  assert.equal(examples.length, 2);
  for (const [, template, raw] of examples) {
    assert.equal(JSON.parse(raw).reportMarkdown, template);
  }
  assert.ok(examples[0][1].includes('3/8\\\\\\"'));
  assert.ok(examples[1][1].includes('rounding or precision'));
});

test('F3 unsuccessful first live batch remains rejected by unchanged validators', async t => {
  const directory = path.join(root, 'evidence/f3-20261030T2218Z');
  const audit = fs.readFileSync(path.join(directory, 'audit.jsonl'), 'utf8')
    .trim().split('\n').map(JSON.parse);
  const failures = audit.filter(row =>
    ['adversarial-reviewer', 'final-review-writer'].includes(row.agent) && row.status !== 'SUCCESS');
  assert.equal(failures.length, 7);
  for (const failure of failures) {
    const base = path.join(directory, 'runs', failure.correlationId,
      `cycle-${failure.cycle}`, failure.agent);
    await replay(t, failure.agent, readJson(`${base}-input.json`),
      fs.readFileSync(`${base}-raw.txt`, 'utf8'), failure.status);
  }
});

test('F3 exact historical writer deviations reject while exact round-trips validate', async t => {
  for (const ticket of [4, 5]) {
    const { input, raw } = frozenStep(ticket, 'final-review-writer');
    const expected = reportTemplate(input);
    const actual = JSON.parse(raw).reportMarkdown;
    assert.notEqual(actual, expected);
    if (ticket === 4) {
      assert.ok(expected.includes('3/8\\\\\\"'));
      assert.ok(actual.includes('3/8\\"'));
    } else {
      assert.ok(expected.includes('No rounding or precision rules'));
      assert.ok(actual.includes('No rounding and precision rules'));
    }
    await replay(t, 'final-review-writer', input, raw, 'GOVERNANCE_FAILURE');
    const correctRaw = JSON.stringify({ reportMarkdown: expected });
    assert.equal(JSON.parse(correctRaw).reportMarkdown, expected);
    await replay(t, 'final-review-writer', input, correctRaw);
  }
});
