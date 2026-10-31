const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { isDeepStrictEqual } = require('util');
const registry = require('./agent-registry');
const { deriveDisposition, validateInterpretationTransition, validateReview } = require('./governance-policy');
const { configured } = require('./eval-scorer');

const root = path.resolve(__dirname, '..');
const hash = value => createHash('sha256').update(value).digest('hex');
const inputHash = value => hash(JSON.stringify(value));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function requireEvidence(condition, message) {
  if (!condition) throw Object.assign(new Error(message), { code: 'EVAL_EVIDENCE_FAILURE' });
}

function validateObservation(observation, testCase) {
  const { provenance, rawResponse, input } = observation;
  requireEvidence(provenance && provenance.runtimeMode === 'real', 'Model evidence requires explicit real mode.');
  requireEvidence(observation.agent === testCase.agent && isDeepStrictEqual(input, testCase.input),
    'Response does not match the fixed case input and agent.');
  requireEvidence(typeof rawResponse === 'string', 'Raw response is required; parsed-only evidence is insufficient.');
  requireEvidence(provenance.inputHash === inputHash(input) && provenance.rawHash === hash(rawResponse),
    'Response input/raw hash mismatch.');
  requireEvidence(typeof provenance.model === 'string' && provenance.model.trim()
    && provenance.modelSettings && Number.isFinite(provenance.modelSettings.temperature)
    && typeof provenance.correlationId === 'string' && provenance.correlationId.trim()
    && Number.isFinite(Date.parse(provenance.timestamp)), 'Incomplete response provenance.');
  for (const field of ['promptHash', 'schemaHash']) {
    requireEvidence(/^[a-f0-9]{64}$/.test(provenance[field]), `Missing ${field}.`);
  }
  const agent = registry[observation.agent];
  requireEvidence(agent && agent.requiredInputs.every(key => Object.hasOwn(input, key))
    && Object.keys(input).every(key => agent.allowedInputs.includes(key)), 'Unexpected agent input boundary.');
}

function workflowObservations(run, ticket, artifactRoot = root) {
  requireEvidence(run && ['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(run.status),
    'Workflow must have an explicit completed status.');
  requireEvidence(run.runtimeMode === 'real' && typeof run.correlationId === 'string',
    'Workflow mode/identity is missing or not real.');
  requireEvidence(Array.isArray(run.reviewCycles) && run.reviewCycles.length > 0, 'Missing review-cycle evidence.');
  const observations = [];
  const loadStep = (step, agent, cycle, input) => {
    requireEvidence(step?.success === true && step.agentId === agent && step.cycle === cycle
      && step.runtimeMode === 'real' && step.correlationId === run.correlationId,
    `Incomplete or mismatched step: ${agent}, cycle ${cycle}.`);
    const audit = step.audit;
    requireEvidence(audit?.status === 'SUCCESS' && audit.agent === agent && audit.cycle === cycle
      && audit.correlationId === run.correlationId && audit.outputHash === inputHash(step.output),
    `Invalid step audit: ${agent}, cycle ${cycle}.`);
    requireEvidence(typeof audit.rawArtifact === 'string' && typeof audit.validatedArtifact === 'string',
      `Missing persisted artifacts: ${agent}.`);
    const rawFile = path.resolve(artifactRoot, audit.rawArtifact);
    const directory = path.dirname(rawFile);
    const persistedInput = readJson(path.join(directory, `${agent}-input.json`));
    const manifest = readJson(path.join(directory, `${agent}-manifest.json`));
    const prompt = fs.readFileSync(path.join(directory, `${agent}-prompt.txt`), 'utf8');
    const rawResponse = fs.readFileSync(rawFile, 'utf8');
    requireEvidence(isDeepStrictEqual(persistedInput, input) && isDeepStrictEqual(manifest, audit)
      && isDeepStrictEqual(readJson(path.resolve(artifactRoot, audit.validatedArtifact)), step.output)
      && isDeepStrictEqual(JSON.parse(rawResponse), step.output) && hash(prompt) === audit.promptHash,
    `Persisted input/output/prompt/manifest mismatch: ${agent}.`);
    const observation = { agent, input, rawResponse, provenance: audit, cycle };
    validateObservation(observation, { agent, input });
    observations.push(observation);
  };
  let previousInterpretation;
  let previousReview;
  for (let i = 0; i < run.reviewCycles.length; i++) {
    const cycle = run.reviewCycles[i];
    requireEvidence(cycle.cycle === i + 1, 'Review cycles must be contiguous from 1.');
    const interpreterInput = previousInterpretation
      ? { ticket, previousInterpretation, reviewerFindings: previousReview.findings }
      : { ticket };
    loadStep(cycle.interpreterResult, 'requirement-interpreter', i + 1, interpreterInput);
    validateInterpretationTransition(cycle.interpreterResult.output, interpreterInput);
    const reviewInput = { ticket, interpreterResult: cycle.interpreterResult.output,
      ...(previousReview ? { previousReview } : {}) };
    loadStep(cycle.reviewResult, 'adversarial-reviewer', i + 1, reviewInput);
    validateReview(cycle.reviewResult.output, reviewInput);
    const policy = deriveDisposition(cycle.interpreterResult.output, cycle.reviewResult.output);
    requireEvidence(cycle.disposition === policy.disposition
      && isDeepStrictEqual(cycle.reasonCodes, policy.reasonCodes), 'Cycle policy contradicts its artifacts.');
    previousInterpretation = cycle.interpreterResult.output;
    previousReview = cycle.reviewResult.output;
  }
  const first = run.reviewCycles[0];
  const last = run.reviewCycles[run.reviewCycles.length - 1];
  requireEvidence(isDeepStrictEqual(run.interpreterResult, first.interpreterResult)
    && isDeepStrictEqual(run.reviewResult, first.reviewResult)
    && isDeepStrictEqual(run.finalInterpreterResult, last.interpreterResult)
    && isDeepStrictEqual(run.finalReviewResult, last.reviewResult), 'Final/initial artifacts do not match cycles.');
  const policy = deriveDisposition(previousInterpretation, previousReview);
  requireEvidence(run.disposition === policy.disposition && isDeepStrictEqual(run.reasonCodes, policy.reasonCodes),
    'Workflow disposition contradicts governance policy.');
  loadStep(run.finalReport, 'final-review-writer', run.reviewCycles.length, {
    interpreterResult: previousInterpretation, reviewResult: previousReview, ...policy
  });
  return observations;
}

function comparePaired(baseline, current) {
  const pairs = [];
  const unpaired = [];
  const key = row => JSON.stringify([row.caseId, row.agent, row.inputHash, row.model, row.modelSettings, row.scorerHash]);
  configured(new Set(baseline.map(key)).size === baseline.length && new Set(current.map(key)).size === current.length,
    'Duplicate comparison identities.');
  for (const row of current) {
    const prior = baseline.find(value => key(value) === key(row));
    if (!prior) {
      unpaired.push({ caseId: row.caseId, agent: row.agent, reason: 'No baseline with identical case, input, model, settings, and scorer.' });
      continue;
    }
    pairs.push({
      caseId: row.caseId, agent: row.agent,
      metrics: Object.fromEntries(Object.entries(row.score.metrics).map(([name, data]) => {
        const before = prior.score.metrics[name];
        const comparable = before?.applicable && data.applicable;
        return [name, { baselineScore: before?.score ?? null, currentScore: data.score,
          delta: comparable ? data.score - before.score : null }];
      }))
    });
  }
  return { pairs, unpaired, baselineOnly: baseline.filter(row => !current.some(value => key(value) === key(row))).map(row => row.caseId) };
}

module.exports = { hash, inputHash, readJson, validateObservation, workflowObservations, comparePaired };
