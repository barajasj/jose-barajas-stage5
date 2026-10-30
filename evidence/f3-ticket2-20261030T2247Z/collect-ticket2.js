require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { createAgentRunner } = require('../../src/agent-runner');
const { executeWorkflow } = require('../../src/coordinator');
const { invokeLlm } = require('../../src/models/fireworks-client');
const { hash } = require('../../src/eval-evidence');
const { writeJson, snapshotSources, sealPackage, root, relative } =
  require('../../src/evidence-package');

const directory = __dirname;
const historical = path.join(root, 'evidence/d5-20261030T1940Z');
const batchA = path.join(root, 'evidence/f3-20261030T2218Z');
const batchB = path.join(root, 'evidence/f3-20261030T2225Z');
const outputFile = path.join(directory, 'ticket2-run.json');
const auditFile = path.join(directory, 'audit.jsonl');
const runsDir = relative(path.join(directory, 'runs'));
const ticketFile = path.join(root, 'fixtures/hvac-ticket-2.md');
const manifestPath = directory => {
  const final = path.join(directory, 'manifest-final.json');
  return fs.existsSync(final) ? final : path.join(directory, 'manifest.json');
};

async function main() {
  if (!process.env.AI_API_KEY || fs.existsSync(outputFile) || fs.existsSync(auditFile)
    || fs.existsSync(path.join(directory, 'manifest.json'))) {
    throw new Error('Fireworks key required and evidence target must be unused.');
  }
  const ticket = fs.readFileSync(ticketFile, 'utf8');
  const prior = [
    { directory: relative(batchA), file: manifestPath(batchA) },
    { directory: relative(batchB), file: manifestPath(batchB) }
  ].map(row => ({
    directory: row.directory,
    manifestFile: path.basename(row.file),
    manifestSha256: hash(fs.readFileSync(row.file)),
    workflowSummary: JSON.parse(fs.readFileSync(path.join(row.directory, 'comparison.json'), 'utf8'))
      .groups.workflows
  }));
  const originalSeal = path.join(historical, 'manifest-final.json');
  const originalSealHash = hash(fs.readFileSync(originalSeal));
  const source = snapshotSources(directory);
  const plan = {
    startedAt: new Date().toISOString(),
    scope: 'One prospective F3 Ticket 2 workflow; no F6 changes or scorer/evaluator execution.',
    fixture: relative(ticketFile), ticketHash: hash(ticket),
    runtimeMode: 'real', maxReviewCycles: 2, maxModelInvocations: 5,
    model: 'accounts/fireworks/models/gpt-oss-120b', temperature: 0,
    sourcePromptHash: hash(fs.readFileSync(path.join(root, 'agents/requirement-interpreter.md'))),
    priorF3Manifests: prior.map(({ directory, manifestFile, manifestSha256 }) =>
      ({ directory, manifestFile, manifestSha256 })),
    policy: 'One workflow attempt; coordinator review cycles only; no collection-level retry or output repair.'
  };
  writeJson(path.join(directory, 'source-state.json'), source);
  writeJson(path.join(directory, 'collection-plan.json'), plan);
  writeJson(path.join(directory, 'prior-f3.json'), {
    originalEvidenceSealSha256: originalSealHash, batches: prior
  });
  fs.writeFileSync(path.join(directory, 'fixture.md'), ticket, { flag: 'wx' });
  fs.mkdirSync(path.join(directory, 'receipts'));

  let modelInvocations = 0;
  const receipts = [];
  const agentRunner = createAgentRunner({ invokeModel: async request => {
    if (modelInvocations >= plan.maxModelInvocations) {
      throw new Error('Authorized Ticket 2 invocation limit reached.');
    }
    const sequence = ++modelInvocations;
    const receipt = {
      sequence, startedAt: new Date().toISOString(), model: request.model,
      temperature: request.temperature, promptHash: hash(request.prompt)
    };
    let response;
    try {
      response = await invokeLlm(request);
      Object.assign(receipt, {
        status: 'RESPONSE_RECEIVED', rawHash: hash(response.content),
        promptTokens: response.promptTokens ?? null,
        completionTokens: response.completionTokens ?? null,
        totalTokens: response.totalTokens ?? null
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
  const correlationId = `F3-TICKET2-${Date.now()}`;
  const workflow = await executeWorkflow(ticket, {
    correlationId, runtimeMode: 'real', maxReviewCycles: plan.maxReviewCycles,
    runsDir, auditFile: relative(auditFile), agentRunner
  });
  writeJson(outputFile, workflow);

  const previousSummary = JSON.parse(fs.readFileSync(path.join(batchB, 'all-attempts.json'), 'utf8'));
  const priorWorkflowRates = previousSummary.groups.workflows;
  const thisSuccess = Number(['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(workflow.status));
  const combinedSuccesses = priorWorkflowRates.allNewAttempts.successes + thisSuccess;
  const combinedAttempts = priorWorkflowRates.allNewAttempts.attempts + 1;
  const priorTicket2 = [
    { batch: 'evidence/f3-20261030T2218Z', file: 'workflows/ticket2-run.json' },
    { batch: 'evidence/f3-20261030T2225Z', file: 'workflows/ticket2-run.json' }
  ].map(row => {
    const previous = JSON.parse(fs.readFileSync(path.join(root, row.batch, row.file), 'utf8'));
    return {
      batch: row.batch, correlationId: previous.correlationId,
      status: previous.status, disposition: previous.disposition
    };
  });
  const ticket2Attempts = [...priorTicket2.map(row => row.status), workflow.status];
  const ticket2Successes = ticket2Attempts.filter(status =>
    ['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(status)).length;
  const latestAttempts = priorWorkflowRates.latestBatch.attempts + 1;
  const latestSuccesses = priorWorkflowRates.latestBatch.successes + thisSuccess;
  const workflowCompletion = {
    originalBefore: priorWorkflowRates.before,
    beforeLatestFive: priorWorkflowRates.latestBatch,
    beforeAllNew: priorWorkflowRates.allNewAttempts,
    thisTicket2Attempt: {
      attempts: 1,
      successes: Number(['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(workflow.status)),
      failures: Number(!['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(workflow.status))
    },
    afterAllNew: {
      attempts: combinedAttempts, successes: combinedSuccesses,
      failures: combinedAttempts - combinedSuccesses,
      completionRate: combinedSuccesses / combinedAttempts,
      failureRate: (combinedAttempts - combinedSuccesses) / combinedAttempts
    },
    afterLatestSix: {
      attempts: latestAttempts, successes: latestSuccesses, failures: latestAttempts - latestSuccesses,
      completionRate: latestSuccesses / latestAttempts,
      failureRate: (latestAttempts - latestSuccesses) / latestAttempts
    },
    ticket2Attempts,
    ticket2PriorWorkflows: priorTicket2.map(row => ({
      batch: row.batch, correlationId: row.correlationId,
      status: row.status, disposition: row.disposition
    })),
    ticket2AfterRate: {
      attempts: ticket2Attempts.length, successes: ticket2Successes,
      failures: ticket2Attempts.length - ticket2Successes,
      completionRate: ticket2Successes / ticket2Attempts.length,
      failureRate: (ticket2Attempts.length - ticket2Successes) / ticket2Attempts.length
    },
    ticket2After: { status: workflow.status, disposition: workflow.disposition }
  };
  writeJson(path.join(directory, 'workflow-completion.json'), workflowCompletion);
  writeJson(path.join(directory, 'usage.json'), {
    modelInvocations, authorizedLimit: plan.maxModelInvocations,
    receipts: receipts.length,
    tokens: receipts.reduce((total, receipt) => ({
      prompt: total.prompt + (receipt.promptTokens || 0),
      completion: total.completion + (receipt.completionTokens || 0),
      total: total.total + (receipt.totalTokens || 0)
    }), { prompt: 0, completion: 0, total: 0 })
  });
  const preserved = {
    historicalCollectionSealUnchanged: hash(fs.readFileSync(originalSeal)) === originalSealHash,
    priorF3ManifestsUnchanged: prior.every(row =>
      hash(fs.readFileSync(path.join(root, row.directory, row.manifestFile))) === row.manifestSha256)
  };
  if (!preserved.historicalCollectionSealUnchanged || !preserved.priorF3ManifestsUnchanged) {
    throw new Error('Prior evidence seal changed during Ticket 2 collection.');
  }
  writeJson(path.join(directory, 'preservation-check.json'), preserved);
  const usage = JSON.parse(fs.readFileSync(path.join(directory, 'usage.json'), 'utf8'));
  const report = [
    '# Ticket 2 F3 Follow-Up',
    '',
    'One prospective real-model Ticket 2 workflow after the ambiguity-resolution prompt fix. No F6 changes.',
    '',
    '## Result',
    '',
    `- Workflow: ${workflow.status}; disposition: ${workflow.disposition}.`,
    `- Failure reason: ${workflow.reason || 'none'}.`,
    `- Fireworks calls: ${usage.modelInvocations}; tokens (prompt/completion/total): ${usage.tokens.prompt}/${usage.tokens.completion}/${usage.tokens.total}.`,
    '- A completed workflow means validated report generation, not a PASS disposition.',
    '',
    '## Completion Comparison',
    '',
    '| Cohort | Before | After this attempt |',
    '| --- | ---: | ---: |',
    `| Original workflow batch | ${workflowCompletion.originalBefore.successes}/${workflowCompletion.originalBefore.attempts} (${(workflowCompletion.originalBefore.completionRate * 100).toFixed(1)}%) | unchanged historical cohort |`,
    `| First two F3 batches, all attempts | ${workflowCompletion.beforeAllNew.successes}/${workflowCompletion.beforeAllNew.attempts} (${(workflowCompletion.beforeAllNew.completionRate * 100).toFixed(1)}%) | ${workflowCompletion.afterAllNew.successes}/${workflowCompletion.afterAllNew.attempts} (${(workflowCompletion.afterAllNew.completionRate * 100).toFixed(1)}%) |`,
    `| Latest F3 batch plus Ticket 2 rerun | ${workflowCompletion.beforeLatestFive.successes}/${workflowCompletion.beforeLatestFive.attempts} (${(workflowCompletion.beforeLatestFive.completionRate * 100).toFixed(1)}%) | ${workflowCompletion.afterLatestSix.successes}/${workflowCompletion.afterLatestSix.attempts} (${(workflowCompletion.afterLatestSix.completionRate * 100).toFixed(1)}%) |`,
    `| Ticket 2 attempts | ${workflowCompletion.ticket2PriorWorkflows.filter(row => ['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(row.status)).length}/2 complete | ${workflowCompletion.ticket2AfterRate.successes}/3 complete |`,
    '',
    'All attempts remain in the referenced F3 packages and this follow-up. Failed attempts count as failures; no prior workflow or evidence file was overwritten.',
    '',
    '## Artifacts',
    '',
    '- `ticket2-run.json`, `runs/`, `audit.jsonl`, and `receipts/`: workflow result and actual model inputs, prompts, raw outputs, validated outputs where produced, audit records, and usage.',
    '- `workflow-completion.json`: per-batch, cumulative, latest-six, and Ticket 2 rates.',
    '- `prior-f3.json`: prior manifests and workflow summaries; `preservation-check.json`: original and prior F3 seals unchanged.',
    '- `source/` and `source-state.json`: executed source snapshot and working-tree provenance.',
    '- `manifest.json` and `manifest-final.json`: collection and final inventory seals.',
    '',
    'No completion claim implies PASS; disposition and any remaining blocker are reported separately.'
  ].join('\n');
  fs.writeFileSync(path.join(directory, 'F3-TICKET2-FOLLOWUP.md'), report, { flag: 'wx' });
  sealPackage(directory, {
    modelInvocations, ticketHash: plan.ticketHash, workflowStatus: workflow.status,
    priorF3Manifests: plan.priorF3Manifests
  });
  sealPackage(directory, {
    modelInvocations, ticketHash: plan.ticketHash, workflowStatus: workflow.status,
    priorF3Manifests: plan.priorF3Manifests
  }, 'manifest-final.json');
  console.log(JSON.stringify({
    correlationId, status: workflow.status, disposition: workflow.disposition,
    reason: workflow.reason || null, modelInvocations, workflowCompletion
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'TICKET2_COLLECTION_FAILURE', reason: error.message }));
  process.exitCode = 1;
});
