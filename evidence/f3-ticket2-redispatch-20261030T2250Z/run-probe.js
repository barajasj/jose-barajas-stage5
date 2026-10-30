require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const { createAgentRunner } = require('../../src/agent-runner');
const { invokeLlm } = require('../../src/models/fireworks-client');
const { hash } = require('../../src/eval-evidence');
const { writeJson, snapshotSources, sealPackage, root } = require('../../src/evidence-package');

const directory = __dirname;
const sourcePackage = path.join(root, 'evidence/f3-20261030T2225Z');
const failedCorrelation = 'HVAC-TICKET-1793399289234-fa1f13c9-0d5a-4be7-828f-b20b19021313';
const priorDirectory = path.join(sourcePackage, 'runs', failedCorrelation, 'cycle-2');
const sourceInputFile = path.join(priorDirectory, 'requirement-interpreter-input.json');
const sourceRequestFile = path.join(priorDirectory, 'requirement-interpreter-request.json');
const correlationId = `F3-TICKET2-REDISPATCH-${Date.now()}`;

async function main() {
  if (!process.env.AI_API_KEY || fs.existsSync(path.join(directory, 'probe-result.json'))
    || fs.existsSync(path.join(directory, 'manifest.json'))) {
    throw new Error('Fireworks key required and probe target must be unused.');
  }
  const input = JSON.parse(fs.readFileSync(sourceInputFile, 'utf8'));
  const originalRequest = JSON.parse(fs.readFileSync(sourceRequestFile, 'utf8'));
  if (hash(JSON.stringify(input)) !== originalRequest.inputHash) {
    throw new Error('Preserved Ticket 2 failure input does not match its original request.');
  }
  const priorFinal = path.join(sourcePackage, 'manifest-final.json');
  const priorFinalHash = hash(fs.readFileSync(priorFinal));
  const source = snapshotSources(directory);
  writeJson(path.join(directory, 'source-state.json'), source);
  writeJson(path.join(directory, 'probe-plan.json'), {
    startedAt: new Date().toISOString(), scope: 'One real interpreter redispatch probe; not a workflow attempt.',
    inputSource: path.relative(root, sourceInputFile).split(path.sep).join('/'),
    sourceInputHash: originalRequest.inputHash,
    priorFailure: {
      correlationId: failedCorrelation,
      reason: 'Ambiguity resolution must identify a removed prior ambiguity and explain the correction.'
    },
    model: 'accounts/fireworks/models/gpt-oss-120b', temperature: 0,
    maxModelInvocations: 1, noRetryOrRepair: true
  });
  fs.mkdirSync(path.join(directory, 'receipts'));
  let calls = 0;
  const runner = createAgentRunner({ invokeModel: async request => {
    if (calls++) throw new Error('Redispatch probe invocation limit reached.');
    const receipt = {
      startedAt: new Date().toISOString(), model: request.model, temperature: request.temperature,
      promptHash: hash(request.prompt)
    };
    try {
      const response = await invokeLlm(request);
      Object.assign(receipt, {
        status: 'RESPONSE_RECEIVED', rawHash: hash(response.content),
        promptTokens: response.promptTokens ?? null,
        completionTokens: response.completionTokens ?? null,
        totalTokens: response.totalTokens ?? null
      });
      receipt.finishedAt = new Date().toISOString();
      writeJson(path.join(directory, 'receipts/1.json'), receipt);
      return response;
    } catch {
      receipt.status = 'MODEL_FAILURE';
      receipt.finishedAt = new Date().toISOString();
      writeJson(path.join(directory, 'receipts/1.json'), receipt);
      throw new Error('Model request failed.');
    }
  } });
  let outcome;
  let output;
  try {
    const result = await runner('requirement-interpreter', input, correlationId, {
      cycle: 2, runtimeMode: 'real',
      runsDir: path.relative(root, path.join(directory, 'runs')).split(path.sep).join('/'),
      auditFile: path.relative(root, path.join(directory, 'audit.jsonl')).split(path.sep).join('/')
    });
    outcome = { status: 'SUCCESS', promptHash: result.audit.promptHash };
    output = result.output;
  } catch (error) {
    outcome = {
      status: error.code || 'COLLECTION_FAILURE', reason: error.message,
      correlationId: error.correlationId || correlationId,
      details: error.details || null
    };
    const parsed = path.join(directory, 'runs', correlationId, 'cycle-2',
      'requirement-interpreter-parsed.json');
    if (fs.existsSync(parsed)) output = JSON.parse(fs.readFileSync(parsed, 'utf8'));
  }
  const previous = input.previousInterpretation.ambiguities;
  const current = output?.ambiguities || [];
  const resolutions = output?.ambiguityResolutions || [];
  const removed = previous.filter(text => !current.includes(text));
  const identityChecks = resolutions.map(resolution => ({
    resolution: resolution.ambiguity,
    exactPreviousIdentity: previous.includes(resolution.ambiguity),
    exactRemovedIdentity: removed.includes(resolution.ambiguity),
    sourceQuotePresentInTicket: input.ticket.includes(resolution.sourceQuote)
  }));
  const resolutionCounts = new Map(resolutions.map(resolution =>
    [resolution.ambiguity, resolutions.filter(item => item.ambiguity === resolution.ambiguity).length]));
  const unmatchedPrior = previous.filter(text =>
    !current.includes(text) && !resolutions.some(item => item.ambiguity === text));
  const result = {
    generatedAt: new Date().toISOString(), correlationId, outcome,
    sourceFailure: {
      correlationId: failedCorrelation,
      inputHash: originalRequest.inputHash,
      priorAmbiguities: previous,
      reviewerFindingIds: input.reviewerFindings.map(finding => finding.id)
    },
    generatedOutput: output || null,
    transitionChecks: {
      priorAmbiguities: previous.length, currentAmbiguities: current.length,
      removedPriorAmbiguities: removed,
      resolutionCount: resolutions.length,
      identityChecks,
      duplicateResolutionIds: [...resolutionCounts].filter(([, count]) => count > 1).map(([id]) => id),
      unansweredPriorAmbiguitiesNotPreserved: unmatchedPrior,
      acceptedByUnchangedSchemaAndTransitionValidator: outcome.status === 'SUCCESS'
    },
    limitation: 'One direct redispatch probe, not a workflow; excluded from workflow completion rates.'
  };
  writeJson(path.join(directory, 'probe-result.json'), result);
  const preserved = hash(fs.readFileSync(priorFinal)) === priorFinalHash;
  writeJson(path.join(directory, 'preservation-check.json'), {
    priorF3ManifestFinalSha256: priorFinalHash, priorF3Unchanged: preserved
  });
  if (!preserved) throw new Error('Prior F3 package changed during the probe.');
  const report = [
    '# Ticket 2 Redispatch Probe',
    '',
    'One direct real-model requirement-interpreter call using the exact preserved cycle-2 input that previously failed. This is not an additional workflow and is excluded from completion statistics.',
    '',
    `- Outcome: ${outcome.status}.`,
    `- Previous ambiguities: ${previous.length}; current ambiguities: ${current.length}; removals: ${removed.length}; resolutions: ${resolutions.length}.`,
    `- Exact prior-identity checks passed: ${identityChecks.filter(check => check.exactPreviousIdentity && check.exactRemovedIdentity && check.sourceQuotePresentInTicket).length}/${identityChecks.length}.`,
    `- Unanswered prior ambiguities lost: ${unmatchedPrior.length}.`,
    `- Runtime reason: ${outcome.reason || 'none'}.`,
    '',
    'See `probe-result.json` for output and per-resolution checks, `runs/` for raw/input/prompt/validated artifacts, `audit.jsonl` for runtime result, and `receipts/` for provider usage.',
    '',
    'The paired Ticket 2 workflow is in `evidence/f3-ticket2-20261030T2247Z/`. Workflow completion remains measured only from workflow attempts.'
  ].join('\n');
  fs.writeFileSync(path.join(directory, 'REDISPATCH-PROBE.md'), report, { flag: 'wx' });
  sealPackage(directory, { modelInvocations: calls, sourceInputHash: originalRequest.inputHash });
  sealPackage(directory, { modelInvocations: calls, sourceInputHash: originalRequest.inputHash },
    'manifest-final.json');
  console.log(JSON.stringify({
    status: outcome.status, correlationId, resolutionCount: resolutions.length,
    removed: removed.length, unansweredPriorLost: unmatchedPrior.length,
    workflowCompletionRateUnchanged: true
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({ status: 'REDISPATCH_PROBE_FAILURE', reason: error.message }));
  process.exitCode = 1;
});
