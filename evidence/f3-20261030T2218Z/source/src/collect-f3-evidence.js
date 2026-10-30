require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { createAgentRunner } = require('./agent-runner');
const { executeWorkflow } = require('./coordinator');
const { invokeLlm } = require('./models/fireworks-client');
const { directObservation } = require('./collect-eval-evidence');
const { hash, readJson } = require('./eval-evidence');
const { runAudit } = require('./run-load-bearing-audit');
const { root, relative, writeJson, snapshotSources, sealPackage } = require('./evidence-package');

const historical = path.join(root, 'evidence/d5-20261030T1940Z');
const completed = row => ['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(row.status);
const succeeded = row => row.status === 'SUCCESS';
const identityFields = [
  'inputHash', 'model', 'modelSettings', 'schemaHash', 'governancePolicyHash', 'reportContractHash'
];

function rates(rows, accepts = succeeded) {
  const successes = rows.filter(accepts).length;
  return {
    attempts: rows.length, successes, failures: rows.length - successes,
    completionRate: rows.length ? successes / rows.length : null,
    failureRate: rows.length ? (rows.length - successes) / rows.length : null
  };
}

function pairedIdentity(before, after) {
  return identityFields.every(field => before[field] !== undefined
    && JSON.stringify(before[field]) === JSON.stringify(after?.[field]));
}

function frozenCases(workflows) {
  const observations = readJson(path.join(historical, 'direct-responses.json')).observations;
  const direct = observations.filter(row => row.agent === 'adversarial-reviewer').map(row => ({
    id: row.caseId, group: 'directReviewer', agent: row.agent, input: row.input,
    beforeRaw: row.rawResponse, before: row.provenance,
    beforeOutcome: row.provenance.runtimeOutcome
  }));
  for (const [ticket, agent, group] of [
    [2, 'adversarial-reviewer', 'frozenReviewer'], [3, 'adversarial-reviewer', 'frozenReviewer'],
    [4, 'final-review-writer', 'frozenWriter'], [5, 'final-review-writer', 'frozenWriter']
  ]) {
    const base = path.join(historical, 'runs', workflows[ticket - 1].run.correlationId,
      'cycle-1', agent);
    direct.push({
      id: `ticket${ticket}-${agent}`, group, agent,
      input: readJson(`${base}-input.json`),
      beforeRaw: fs.readFileSync(`${base}-raw.txt`, 'utf8'),
      before: readJson(`${base}-request.json`),
      beforeOutcome: { status: workflows[ticket - 1].run.status,
        reason: workflows[ticket - 1].run.reason }
    });
  }
  return direct;
}

function comparison(cases, attempts, beforeWorkflows, workflows, beforeAudit, afterAudit) {
  const groups = {};
  for (const group of ['directReviewer', 'frozenReviewer', 'frozenWriter']) {
    const selected = cases.filter(row => row.group === group);
    groups[group] = {
      before: rates(selected.map(row => row.beforeOutcome)),
      after: rates(attempts.filter(row => row.group === group))
    };
  }
  groups.workflows = {
    before: rates(beforeWorkflows.map(row => row.run), completed),
    after: rates(workflows, completed)
  };
  for (const [name, agent] of [
    ['workflowReviewers', 'adversarial-reviewer'], ['workflowWriters', 'final-review-writer']
  ]) {
    const select = (audit, ids) => audit.filter(row => ids.has(row.correlationId) && row.agent === agent);
    groups[name] = {
      before: rates(select(beforeAudit, new Set(beforeWorkflows.map(row => row.run.correlationId)))),
      after: rates(select(afterAudit, new Set(workflows.map(row => row.correlationId))))
    };
  }
  return groups;
}

async function collectF3({ directory, invokeModel = invokeLlm, progress = console.log }) {
  directory = path.resolve(directory);
  const location = path.relative(path.join(root, 'evidence'), directory);
  if (!location || location.startsWith('..') || path.isAbsolute(location) || fs.existsSync(directory)) {
    throw new Error('Use a new directory inside evidence/; existing packages cannot be overwritten.');
  }
  const coverage = runAudit();
  if (!coverage.pass) throw new Error('Coverage preflight failed; no live requests sent.');
  const definitions = readJson(path.join(historical, 'definitions.json'));
  const beforeWorkflows = definitions.fixtures.map((fixture, i) => ({
    id: `ticket${i + 1}`, fixture: fixture.fixture,
    ticket: fs.readFileSync(path.join(root, fixture.fixture), 'utf8'),
    run: readJson(path.join(root, fixture.evidenceFile))
  }));
  const cases = frozenCases(beforeWorkflows);
  if (cases.length !== 20 || beforeWorkflows.length !== 5
    || cases.some(row => hash(JSON.stringify(row.input)) !== row.before.inputHash)) {
    throw new Error('Frozen F3 comparison inputs are missing or changed; no live requests sent.');
  }
  fs.mkdirSync(directory);
  for (const name of ['workflows', 'fixtures', 'receipts']) fs.mkdirSync(path.join(directory, name));
  const source = snapshotSources(directory);
  const beforeAuditFile = path.join(directory, 'before-audit.jsonl');
  fs.copyFileSync(path.join(historical, 'audit.jsonl'), beforeAuditFile, fs.constants.COPYFILE_EXCL);
  writeJson(path.join(directory, 'source-state.json'), source);
  writeJson(path.join(directory, 'coverage.json'), coverage);
  writeJson(path.join(directory, 'frozen-cases.json'), cases);
  writeJson(path.join(directory, 'before-workflows.json'), beforeWorkflows);
  const plan = {
    startedAt: new Date().toISOString(), scope: 'F3 runtime contracts only; no F6 work or semantic scoring.',
    historicalPackage: relative(historical), directCases: cases.map(({ id, agent, group, before }) =>
      ({ id, agent, group, inputHash: before.inputHash })),
    workflowTickets: beforeWorkflows.map(row => ({ id: row.id, ticketHash: hash(row.ticket) })),
    maxModelInvocations: cases.length + beforeWorkflows.length * 5,
    maxReviewCycles: 2, runtimeMode: 'real',
    policy: 'One attempt per case and workflow, all retained; no response repair or collection retries. SDK transport retries may occur.'
  };
  writeJson(path.join(directory, 'collection-plan.json'), plan);
  let modelInvocations = 0;
  const receipts = [];
  const runner = createAgentRunner({ invokeModel: async request => {
    if (modelInvocations >= plan.maxModelInvocations) throw new Error('F3 invocation budget exhausted.');
    const sequence = ++modelInvocations;
    const receipt = { sequence, startedAt: new Date().toISOString(), model: request.model,
      temperature: request.temperature, promptHash: hash(request.prompt) };
    let response;
    try {
      response = await invokeModel(request);
      Object.assign(receipt, {
        status: 'RESPONSE_RECEIVED', rawHash: hash(response.content),
        promptTokens: response.promptTokens ?? null,
        completionTokens: response.completionTokens ?? null, totalTokens: response.totalTokens ?? null
      });
    } catch {
      receipt.status = 'MODEL_FAILURE';
    }
    receipt.finishedAt = new Date().toISOString();
    receipts.push(receipt);
    writeJson(path.join(directory, 'receipts', `${sequence}.json`), receipt);
    if (!response) throw new Error('Model request failed.');
    return response;
  } });
  const runsDir = relative(path.join(directory, 'runs'));
  const auditFile = relative(path.join(directory, 'audit.jsonl'));
  const attempts = [];
  const observations = [];
  for (const testCase of cases) {
    const correlationId = `F3-${testCase.id}-${randomUUID()}`;
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
    const observation = directObservation({ ...testCase, id: testCase.id }, correlationId,
      runsDir, outcome);
    if (observation) observations.push(observation);
    const attempt = {
      caseId: testCase.id, group: testCase.group, agent: testCase.agent, correlationId, ...outcome,
      beforeStatus: testCase.beforeOutcome.status,
      pairedIdentity: pairedIdentity(testCase.before, observation?.provenance),
      beforePromptHash: testCase.before.promptHash,
      afterPromptHash: observation?.provenance.promptHash || null
    };
    attempts.push(attempt);
    writeJson(path.join(directory, `direct-${testCase.id}-attempt.json`), attempt);
    progress(`F3 direct ${testCase.id}: ${outcome.status}`);
  }
  writeJson(path.join(directory, 'direct-responses.json'), { mode: 'real', observations });
  const workflows = [];
  for (const before of beforeWorkflows) {
    fs.writeFileSync(path.join(directory, 'fixtures', `${before.id}.md`), before.ticket, { flag: 'wx' });
    const run = await executeWorkflow(before.ticket, {
      runtimeMode: 'real', maxReviewCycles: 2, runsDir, auditFile, agentRunner: runner
    });
    writeJson(path.join(directory, 'workflows', `${before.id}-run.json`), run);
    workflows.push({
      id: before.id, fixture: before.fixture, ticketHash: hash(before.ticket),
      correlationId: run.correlationId, status: run.status, disposition: run.disposition,
      beforeStatus: before.run.status, beforeDisposition: before.run.disposition,
      reason: run.reason || null, details: run.details || null
    });
    progress(`F3 workflow ${before.id}: ${run.status}/${run.disposition}`);
  }
  const readAudit = file => fs.readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse);
  const groups = comparison(cases, attempts, beforeWorkflows, workflows,
    readAudit(beforeAuditFile), readAudit(path.join(root, auditFile)));
  const summary = {
    startedAt: plan.startedAt, finishedAt: new Date().toISOString(), scope: plan.scope,
    modelInvocations, authorizedLimit: plan.maxModelInvocations, groups, attempts, workflows,
    unpairedCases: attempts.filter(row => !row.pairedIdentity).map(row => row.caseId),
    tokens: receipts.reduce((total, receipt) => ({
      prompt: total.prompt + (receipt.promptTokens || 0),
      completion: total.completion + (receipt.completionTokens || 0),
      total: total.total + (receipt.totalTokens || 0)
    }), { prompt: 0, completion: 0, total: 0 }),
    limitations: [
      'Completion means a validated report, including governed FAIL; it does not mean ticket clearance.',
      'Frozen direct cases pair identical inputs/model/settings/runtime contracts, with changed prompts.',
      'Workflow comparisons use identical tickets but freshly generated upstream artifacts; not isolated prompt effects.',
      'Stage rates include every attempted call, including rejections; stages never reached are not successful attempts.',
      'Single attempts are not repeat-run reliability, semantic accuracy, F4 closure, or F6 prompt-cycle evidence.',
      'No historical archival acceptance configuration, scorer, labels, interpreter prompt, or runtime validator changed.'
    ]
  };
  writeJson(path.join(directory, 'comparison.json'), summary);
  sealPackage(directory, { modelInvocations, sourceCommit: source.commit, scope: plan.scope });
  return summary;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.length !== 3 || argv[0] !== '--output' || argv[2] !== '--allow-live'
    || !process.env.AI_API_KEY) {
    throw new Error('Usage: node src/collect-f3-evidence.js --output evidence/NEW_DIRECTORY --allow-live; AI_API_KEY required.');
  }
  const summary = await collectF3({ directory: argv[1] });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.groups.workflows.after.failures || summary.attempts.some(row => !succeeded(row))
    || summary.unpairedCases.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify({ status: 'F3_COLLECTION_FAILURE', reason: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { rates, pairedIdentity, comparison, collectF3, main };
