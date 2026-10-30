// Offline F3 contract replay and all-attempt accounting; never invokes a model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const { hash } = require(path.join(root, 'src/eval-evidence'));
const { writeJson, verifyPackage } = require(path.join(root, 'src/evidence-package'));
const { validateSchema } = require(path.join(root, 'src/schema-validator'));
const { validateReview, validateInterpretationTransition } = require(path.join(root, 'src/governance-policy'));
const { reportTemplate, validateReport } = require(path.join(root, 'src/report-contract'));
const { firstDifference } = require(path.join(root, 'src/diagnose-eval-evidence'));
const registry = require(path.join(root, 'src/agent-registry'));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const batches = ['evidence/f3-20261030T2218Z', 'evidence/f3-20261030T2225Z'];
const diagnostics = [];
const checked = { requests: 0, accepted: 0, rejected: 0, exactWriterReports: 0 };
const summaries = [];

for (const batch of batches) {
  const directory = path.join(root, batch);
  const summary = readJson(path.join(directory, 'comparison.json'));
  summaries.push(summary);
  const manifest = readJson(path.join(directory, 'manifest.json'));
  for (const entry of manifest.files) {
    assert.equal(hash(fs.readFileSync(path.join(directory, entry.file))), entry.sha256);
  }
  const audit = fs.readFileSync(path.join(directory, 'audit.jsonl'), 'utf8')
    .trim().split('\n').map(JSON.parse).filter(row => Object.hasOwn(registry, row.agent));
  const receipts = fs.readdirSync(path.join(directory, 'receipts')).map(file =>
    readJson(path.join(directory, 'receipts', file)));
  assert.equal(audit.length, summary.modelInvocations);
  assert.equal(receipts.length, audit.length);
  assert.deepEqual(summary.unpairedCases, []);
  for (const entry of audit) {
    const base = path.join(directory, 'runs', entry.correlationId, `cycle-${entry.cycle}`, entry.agent);
    const input = readJson(`${base}-input.json`);
    const prompt = fs.readFileSync(`${base}-prompt.txt`, 'utf8');
    const request = readJson(`${base}-request.json`);
    const raw = fs.readFileSync(`${base}-raw.txt`, 'utf8');
    const output = JSON.parse(raw);
    assert.deepEqual(readJson(`${base}-parsed.json`), output);
    assert.equal(hash(JSON.stringify(input)), request.inputHash);
    assert.equal(hash(prompt), request.promptHash);
    assert.equal(hash(fs.readFileSync(path.join(directory, 'source', registry[entry.agent].promptFile))),
      request.promptTemplateHash);
    const schema = path.join(directory, 'source', registry[entry.agent].schemaFile);
    assert.equal(hash(fs.readFileSync(schema)), request.schemaHash);
    for (const [file, field] of [
      ['governance-policy.js', 'governancePolicyHash'], ['report-contract.js', 'reportContractHash']
    ]) {
      assert.equal(hash(fs.readFileSync(path.join(root, 'src', file))), request[field]);
      assert.equal(hash(fs.readFileSync(path.join(directory, 'source/src', file))), request[field]);
    }
    assert.ok(receipts.some(receipt => receipt.promptHash === request.promptHash
      && receipt.rawHash === hash(raw)));
    checked.requests++;
    const schemaResult = validateSchema(output, schema);
    let problem = schemaResult.valid ? null : {
      status: 'SCHEMA_FAILURE', details: schemaResult.errors
    };
    if (!problem) {
      try {
        if (entry.agent === 'adversarial-reviewer') validateReview(output, input);
        else if (entry.agent === 'final-review-writer') validateReport(output, input);
        else validateInterpretationTransition(output, input);
      } catch (error) {
        problem = { status: error.code, reason: error.message };
      }
    }
    if (entry.status === 'SUCCESS') {
      assert.equal(problem, null);
      assert.deepEqual(readJson(`${base}-validated.json`), output);
      const success = readJson(`${base}-manifest.json`);
      assert.equal(success.rawHash, hash(raw));
      assert.equal(success.outputHash, hash(JSON.stringify(output)));
      checked.accepted++;
      if (entry.agent === 'final-review-writer') checked.exactWriterReports++;
    } else {
      assert.ok(problem);
      assert.equal(problem.status, entry.status);
      assert.equal(fs.existsSync(`${base}-validated.json`), false);
      assert.equal(fs.existsSync(`${base}-manifest.json`), false);
      checked.rejected++;
      const failure = {
        batch, agent: entry.agent, correlationId: entry.correlationId, cycle: entry.cycle,
        status: entry.status, reason: entry.reason,
        rawArtifact: path.relative(root, `${base}-raw.txt`).split(path.sep).join('/'),
        details: entry.details || null
      };
      if (entry.agent === 'final-review-writer') {
        failure.difference = firstDifference(output.reportMarkdown.replace(/\r\n/g, '\n').trim(),
          reportTemplate(input));
      } else if (entry.agent === 'adversarial-reviewer') {
        failure.uncoveredAmbiguities = input.interpreterResult.ambiguities.map((quote, i) =>
          ({ pointer: `/ambiguities/${i}`, quote })).filter(ref =>
          !output.findings.some(f => f.kind === 'OPEN_AMBIGUITY'
            && f.ambiguityRefs?.includes(ref.pointer)));
      } else {
        failure.previousAmbiguities = input.previousInterpretation?.ambiguities || [];
        failure.currentAmbiguities = output.ambiguities;
        failure.ambiguityResolutions = output.ambiguityResolutions || [];
      }
      diagnostics.push(failure);
    }
  }
}

function combine(rows) {
  const attempts = rows.reduce((n, row) => n + row.attempts, 0);
  const successes = rows.reduce((n, row) => n + row.successes, 0);
  return { attempts, successes, failures: attempts - successes,
    completionRate: successes / attempts, failureRate: (attempts - successes) / attempts };
}

assert.equal(verifyPackage(path.join(root, 'evidence/d5-20261030T1940Z')).pass, true);
assert.equal(verifyPackage(path.join(root, batches[0])).pass, true);
const groups = Object.fromEntries(Object.keys(summaries[0].groups).map(group => [group, {
  before: summaries[0].groups[group].before,
  firstBatch: summaries[0].groups[group].after,
  latestBatch: summaries[1].groups[group].after,
  allNewAttempts: combine(summaries.map(summary => summary.groups[group].after))
}]));
const allAttempts = {
  scope: 'F3 observed runtime contract acceptance only, not semantic quality or F6 acceptance.',
  batches: batches.map((directory, i) => ({
    directory, collectionManifestSha256: hash(fs.readFileSync(path.join(root, directory, 'manifest.json'))),
    modelInvocations: summaries[i].modelInvocations, workflows: summaries[i].workflows,
    directAttempts: summaries[i].attempts
  })),
  modelInvocations: checked.requests, groups,
  tokens: summaries.reduce((total, summary) => ({
    prompt: total.prompt + summary.tokens.prompt,
    completion: total.completion + summary.tokens.completion,
    total: total.total + summary.tokens.total
  }), { prompt: 0, completion: 0, total: 0 }),
  workflowCompletionsAreGovernedFail: summaries.every(summary =>
    summary.workflows.filter(row => row.status === 'COMPLETED').every(row => row.disposition === 'FAIL'))
};
const verification = {
  pass: true, checked, frozenInputModelSettingsContractPairs: summaries.reduce(
    (n, summary) => n + summary.attempts.filter(row => row.pairedIdentity).length, 0),
  historicalPackageUnchanged: true, firstBatchUnchanged: true,
  collectionManifestEntriesUnchanged: true, runtimeValidatorsUnchanged: true,
  command: `node ${batches[1]}/verify-f3.js`,
  note: 'Original collection entries checked here; use evidence-package.js for the final inventory seal.'
};
if (process.argv.includes('--write')) {
  writeJson(path.join(__dirname, 'all-attempts.json'), allAttempts);
  writeJson(path.join(__dirname, 'diagnostics.json'), diagnostics);
  writeJson(path.join(__dirname, 'runtime-verification.json'), verification);
}
console.log(JSON.stringify(verification, null, 2));
