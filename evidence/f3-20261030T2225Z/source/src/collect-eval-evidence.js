require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { cases } = require('../evals/step-cases');
const defaults = require('../evals/test-cases.json');
const { createAgentRunner } = require('./agent-runner');
const { executeWorkflow } = require('./coordinator');
const { invokeLlm } = require('./models/fireworks-client');
const { hash, readJson } = require('./eval-evidence');
const { runEvaluation } = require('./eval-runner');
const { runAudit } = require('./run-load-bearing-audit');
const {
  root, relative, writeJson, snapshotSources, exportBaselines, sealPackage
} = require('./evidence-package');

const completed = result => ['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(result.status);

function directObservation(testCase, correlationId, runsDir, outcome) {
  const directory = path.resolve(root, runsDir, correlationId, 'cycle-1');
  const base = path.join(directory, testCase.agent);
  const request = readJson(`${base}-request.json`);
  const rawFile = `${base}-raw.txt`;
  if (!fs.existsSync(rawFile)) return null;
  const rawResponse = fs.readFileSync(rawFile, 'utf8');
  return {
    caseId: testCase.id, agent: testCase.agent,
    input: readJson(`${base}-input.json`), rawResponse,
    provenance: {
      ...request, rawHash: hash(rawResponse),
      rawArtifact: relative(rawFile), runtimeOutcome: outcome
    }
  };
}

async function collectEvidence({ directory, invokeModel = invokeLlm, progress = console.log }) {
  directory = path.resolve(directory);
  const location = path.relative(path.join(root, 'evidence'), directory);
  if (!location || location.startsWith('..') || path.isAbsolute(location) || fs.existsSync(directory)) {
    throw new Error('Use a new directory inside evidence/; existing packages cannot be overwritten.');
  }
  const coverage = runAudit();
  if (!coverage.pass) throw new Error('Coverage preflight failed; no live requests sent.');
  fs.mkdirSync(directory);
  for (const name of ['baselines', 'workflows', 'fixtures', 'receipts']) {
    fs.mkdirSync(path.join(directory, name));
  }
  const source = snapshotSources(directory);
  writeJson(path.join(directory, 'source-state.json'), source);
  const before = runEvaluation({ coverage });
  writeJson(path.join(directory, 'before.json'), before);
  writeJson(path.join(directory, 'coverage.json'), coverage);
  const fixtures = exportBaselines(directory, {
    ...defaults,
    fixtures: defaults.fixtures.filter(fixture => /^fixtures\/hvac-ticket-[1-4]\.md$/.test(fixture.fixture))
  });
  const positive = cases.find(testCase => testCase.id === 'clean');
  const positiveFile = path.join(directory, 'fixtures', 'positive-control.md');
  fs.writeFileSync(positiveFile, positive.input.ticket, { flag: 'wx' });
  fixtures.push({
    fixture: relative(positiveFile),
    baseline: { state: 'not-in-baseline', reason: 'New fully specified positive-control ticket; no historical run.' }
  });
  const definitions = {
    ...defaults,
    fixtures: fixtures.map((fixture, i) => ({
      ...fixture, evidenceFile: relative(path.join(directory, 'workflows', `ticket${i + 1}-run.json`))
    }))
  };
  writeJson(path.join(directory, 'definitions.json'), definitions);
  const plan = {
    startedAt: new Date().toISOString(), source,
    directCases: cases.map(({ id, agent, input }) => ({ id, agent, inputHash: hash(JSON.stringify(input)) })),
    workflowFixtures: definitions.fixtures.map(fixture => fixture.fixture),
    maxModelInvocations: 51, maxReviewCycles: 2, runtimeMode: 'real',
    policy: 'One attempt per direct case and workflow; no repair, selection, or collection-level retries. Provider SDK may retry transport errors.',
    humanGate: 'Existing substance assessment and decision policy retained.'
  };
  writeJson(path.join(directory, 'collection-plan.json'), plan);
  let modelInvocations = 0;
  const runner = createAgentRunner({
    invokeModel: async request => {
      if (modelInvocations >= plan.maxModelInvocations) throw new Error('Authorized invocation budget exhausted.');
      const sequence = ++modelInvocations;
      const startedAt = new Date().toISOString();
      try {
        const response = await invokeModel(request);
        writeJson(path.join(directory, 'receipts', `${sequence}.json`), {
          sequence, startedAt, finishedAt: new Date().toISOString(), model: request.model,
          temperature: request.temperature, promptHash: hash(request.prompt),
          rawHash: hash(response.content), promptTokens: response.promptTokens ?? null,
          completionTokens: response.completionTokens ?? null, totalTokens: response.totalTokens ?? null
        });
        return response;
      } catch {
        writeJson(path.join(directory, 'receipts', `${sequence}-failure.json`), {
          sequence, startedAt, finishedAt: new Date().toISOString(), model: request.model,
          promptHash: hash(request.prompt), status: 'MODEL_FAILURE', reason: 'Model request failed.'
        });
        throw new Error('Model request failed.');
      }
    }
  });
  const runsDir = relative(path.join(directory, 'runs'));
  const auditFile = relative(path.join(directory, 'audit.jsonl'));
  const observations = [];
  const attempts = [];
  for (const testCase of cases) {
    const correlationId = `DIRECT-${testCase.id}-${randomUUID()}`;
    let outcome;
    try {
      await runner(testCase.agent, testCase.input, correlationId, {
        runtimeMode: 'real', cycle: 1, runsDir, auditFile
      });
      outcome = { status: 'SUCCESS' };
    } catch (error) {
      outcome = { status: error.code || 'COLLECTION_FAILURE', reason: error.message,
        ...(error.details ? { details: error.details } : {}) };
    }
    const observation = directObservation(testCase, correlationId, runsDir, outcome);
    if (observation) observations.push(observation);
    const attempt = { caseId: testCase.id, agent: testCase.agent, correlationId,
      hasRawResponse: Boolean(observation), ...outcome };
    attempts.push(attempt);
    writeJson(path.join(directory, `direct-${testCase.id}-attempt.json`), attempt);
    progress(`Direct ${testCase.id}: ${outcome.status}`);
  }
  const responses = { collectedAt: new Date().toISOString(), mode: 'real', observations };
  writeJson(path.join(directory, 'direct-responses.json'), responses);
  const workflows = [];
  for (const fixture of definitions.fixtures) {
    const ticket = fs.readFileSync(path.join(root, fixture.fixture), 'utf8');
    const run = await executeWorkflow(ticket, {
      runtimeMode: 'real', maxReviewCycles: 2, runsDir, auditFile, agentRunner: runner
    });
    writeJson(path.join(root, fixture.evidenceFile), run);
    workflows.push({ fixture: fixture.fixture, correlationId: run.correlationId,
      status: run.status, disposition: run.disposition, completed: completed(run),
      reason: run.reason || null, details: run.details || null });
    progress(`Workflow ${fixture.fixture}: ${run.status}/${run.disposition}`);
  }
  const after = runEvaluation({ responses, definitions, coverage });
  writeJson(path.join(directory, 'after.json'), after);
  const summary = {
    startedAt: plan.startedAt, finishedAt: new Date().toISOString(), source,
    modelInvocations, authorizedLimit: plan.maxModelInvocations,
    observations: observations.length, requiredDirectCases: cases.length,
    directRuntimeSuccesses: attempts.filter(attempt => attempt.status === 'SUCCESS').length,
    directScorerPasses: after.direct.filter(row => row.score.pass).length,
    workflowCompletions: workflows.filter(run => run.completed).length,
    workflows, attempts, evaluationPass: after.pass, errors: after.errors, failures: after.failures,
    limitations: [
      'One prospective batch, not repeated-run reliability or two measured prompt-change cycles per agent.',
      'Historical baseline exports remain original and may be unscorable under current contracts.',
      'Strict proposition labels are unchanged; paraphrase failures are not proof of semantic errors.'
    ]
  };
  writeJson(path.join(directory, 'collection-summary.json'), summary);
  sealPackage(directory, { modelInvocations, sourceCommit: source.commit, evaluationPass: after.pass });
  return summary;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 3 || argv[0] !== '--output' || argv[2] !== '--allow-live'
    || !process.env.AI_API_KEY) {
    throw new Error('Usage: node src/collect-eval-evidence.js --output evidence/NEW_DIRECTORY --allow-live; AI_API_KEY required.');
  }
  const summary = await collectEvidence({ directory: argv[1] });
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.evaluationPass) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'EVIDENCE_COLLECTION_FAILURE', reason: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { collectEvidence, directObservation, main };
