const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { cases } = require('../evals/step-cases');
const { hash } = require('../src/eval-evidence');
const { directObservation, main } = require('../src/collect-eval-evidence');
const { writeJson, sealPackage, verifyPackage, exportBaselines } = require('../src/evidence-package');

function workspace(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage5-package-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('package verification checks hashes, missing/extra files, duplicate paths, and traversal', t => {
  const directory = workspace(t);
  const data = path.join(directory, 'data.json');
  writeJson(data, { measured: false });
  sealPackage(directory, { modelInvocations: 0 });
  assert.equal(verifyPackage(directory).pass, true);
  assert.throws(() => writeJson(data, {}), /EEXIST/);
  fs.writeFileSync(data, '{}');
  assert.equal(verifyPackage(directory).pass, false);
  fs.writeFileSync(data, JSON.stringify({ measured: false }, null, 2) + '\n');
  const extra = path.join(directory, 'extra.txt');
  fs.writeFileSync(extra, 'unlisted');
  assert.match(verifyPackage(directory).errors.join('\n'), /Unlisted/);
  fs.unlinkSync(extra);
  fs.unlinkSync(data);
  assert.match(verifyPackage(directory).errors.join('\n'), /Missing/);
  const manifestFile = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile));
  manifest.files.push(manifest.files[0], { file: '../outside', bytes: 0, sha256: hash('') });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  assert.equal(verifyPackage(directory).errors.filter(error => /Invalid or duplicate/.test(error)).length, 2);
});

test('rejected raw responses remain observations without being relabeled as runtime successes', t => {
  const directory = workspace(t);
  const testCase = cases[0];
  const cycle = path.join(directory, 'DIRECT-test', 'cycle-1');
  fs.mkdirSync(cycle, { recursive: true });
  const base = path.join(cycle, testCase.agent);
  writeJson(`${base}-request.json`, { runtimeMode: 'real', inputHash: hash(JSON.stringify(testCase.input)) });
  writeJson(`${base}-input.json`, testCase.input);
  assert.equal(directObservation(testCase, 'DIRECT-test', directory, { status: 'MODEL_FAILURE' }), null);
  const raw = '```json\nnot valid JSON\n```';
  fs.writeFileSync(`${base}-raw.txt`, raw);
  const observed = directObservation(testCase, 'DIRECT-test', directory, { status: 'JSON_PARSE_FAILURE' });
  assert.equal(observed.rawResponse, raw);
  assert.equal(observed.provenance.rawHash, hash(raw));
  assert.equal(observed.provenance.runtimeOutcome.status, 'JSON_PARSE_FAILURE');
  assert.equal(observed.provenance.status, undefined);
});

test('baseline exports preserve original bytes and eliminate replay dependence on hidden Git refs', t => {
  const directory = workspace(t);
  fs.mkdirSync(path.join(directory, 'baselines'));
  const definitions = require('../evals/test-cases.json');
  const fixtures = exportBaselines(directory, definitions);
  assert.equal(fixtures[3].baseline.state, 'not-in-baseline');
  for (const fixture of fixtures.slice(0, 3)) {
    assert.equal(fixture.baseline.ref, undefined);
    assert.equal(fixture.baseline.state, 'required');
  }
  const exports = JSON.parse(fs.readFileSync(path.join(directory, 'baselines', 'exports.json')));
  assert.equal(exports.length, 3);
  for (let i = 0; i < exports.length; i++) {
    const bytes = fs.readFileSync(path.join(directory, 'baselines', `ticket${i + 1}-run.json`));
    assert.equal(hash(bytes), exports[i].sha256);
    assert.equal(JSON.parse(bytes).status, undefined);
  }
});

test('live collector requires explicit live opt-in before invocation', async () => {
  await assert.rejects(main([]), /--allow-live/);
  await assert.rejects(main(['--output', 'evidence/no-network']), /--allow-live/);
});
