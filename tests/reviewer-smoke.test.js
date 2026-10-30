const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildPrompt } = require('../src/prompt-builder');
const { loadPrompt } = require('../src/prompt-loader');

test('reviewer smoke script supplies null previousReview on the initial review', async () => {
  const root = path.resolve(__dirname, '..');
  const ticket = 'Calculate DX Coil Height as the sum of circuit heights.';
  const interpretation = {
    requirementSummary: ticket,
    hvacTerminology: ['DX Coil Height'],
    businessRules: [ticket],
    developerConsiderations: [],
    ambiguities: [],
    confidence: 'HIGH'
  };
  const review = {
    status: 'PASS',
    rationale: 'The stated summation is captured without open questions.',
    findings: [],
    resolutions: []
  };
  const calls = [];
  const logs = [];
  const errors = [];
  const dependencies = {
    dotenv: { config: () => {} },
    fs: { readFileSync: file => {
      if (file === 'schemas/challenges.schema.json') {
        return fs.readFileSync(path.join(root, file), 'utf8');
      }
      assert.equal(file, 'fixtures/hvac-ticket-1.md');
      return ticket;
    } },
    './models/fireworks-client': { invokeLlm: async request => {
      calls.push(request);
      assert.ok(calls.length <= 2);
      return { content: JSON.stringify(calls.length === 1 ? interpretation : review) };
    } },
    './prompt-loader': { loadPrompt: file => loadPrompt(path.join(root, file)) },
    './prompt-builder': { buildPrompt }
  };
  await vm.runInNewContext(
    fs.readFileSync(path.join(root, 'src/test-reviewer.js'), 'utf8'),
    {
      require: name => {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      console: { log: value => logs.push(value), error: error => errors.push(error.message) }
    }
  );
  assert.deepEqual(errors, []);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].prompt.includes(ticket));
  assert.match(calls[1].prompt, /## Previous Review \(null on the initial cycle\)\s+null\s+## Required Output JSON Schema/);
  assert.deepEqual(JSON.parse(calls[1].prompt.replace(/\r\n/g, '\n')
    .split('## Required Output JSON Schema\n\n')[1]),
    JSON.parse(fs.readFileSync(path.join(root, 'schemas/challenges.schema.json'), 'utf8')));
  assert.equal(calls[1].prompt.includes('{{previousReview}}'), false);
  assert.deepEqual(logs.map(value => JSON.parse(value)), [review]);
});
