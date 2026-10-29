const { runAgent } = require('./agent-runner');
const { generateCorrelationId } = require('./correlation-id');
const { writeAuditEntry } = require('./audit-logger');
const coordinatorTools = require('../coordinator/coordinator-tools.json');
const config = require('./config');
const {
  requireContract,
  validateInterpretationTransition,
  validateReview,
  deriveDisposition
} = require('./governance-policy');

const {
  requiresHumanReview
} = require('./substance-gate');

const {
  getLatestDecision,
  validateDecision,
  isDecisionStale
} = require('./human-review');

async function launch_requirement_interpreter(input, correlationId) {
  return runAgent('requirement-interpreter', input, correlationId);
}

async function launch_adversarial_reviewer(input, correlationId) {
  return runAgent('adversarial-reviewer', input, correlationId);
}

async function launch_final_review_writer(input, correlationId) {
  return runAgent('final-review-writer', input, correlationId);
}

const DEFAULT_ASSESSMENT_FILE =
  'substance-assessment.json';
const DEFAULT_DECISIONS_FILE =
  'human-decisions.jsonl';

// A human approval is only honored within this window;
// stale decisions force a fresh punch-out.
const HUMAN_DECISION_MAX_AGE_MS =
  1000 * 60 * 60 * 24 * 30;

function punchOutResult(
  correlationId,
  reason,
  auditStatus,
  extra = {},
  auditFile = config.auditFile
) {

  writeAuditEntry({
    correlationId,
    workflow: 'hvac-ticket-governance',
    agent: 'coordinator-human-gate',
    status: auditStatus,
    reason,
    timestamp: new Date().toISOString()
  }, auditFile);

  return {
    correlationId,
    status: 'PUNCH_OUT',
    disposition: 'PUNCH_OUT',
    reason,
    ...extra
  };
}

async function executeWorkflowSteps(
  ticket,
  options = {}
) {
  const {
    assessmentFile = DEFAULT_ASSESSMENT_FILE,
    decisionsFile = DEFAULT_DECISIONS_FILE,
    humanDecisionMaxAgeMs = HUMAN_DECISION_MAX_AGE_MS,
    maxReviewCycles = config.maxReviewCycles,
    runtimeMode = config.runtimeMode,
    runsDir = config.runsDir,
    auditFile = config.auditFile,
    agentRunner = runAgent,
    correlationId
  } = options;

  const executedSteps = [];
  const reviewCycles = [];
  requireContract(Number.isInteger(maxReviewCycles) && maxReviewCycles > 0,
    'maxReviewCycles must be a positive integer including the initial review.');
  requireContract(['mock', 'real'].includes(runtimeMode), 'Runtime mode must be mock or real.');
  const dispatch = async (agentId, input, cycle) => {
    const result = await agentRunner(agentId, input, correlationId, {
      cycle, runtimeMode, runsDir, auditFile
    });
    executedSteps.push(result);
    return result;
  };
  let finalInterpreterResult;
  let finalReviewResult;
  for (let cycle = 1; cycle <= maxReviewCycles; cycle++) {
    const interpreterInput = { ticket };
    const previousReview = finalReviewResult?.output;
    if (finalInterpreterResult) {
      interpreterInput.previousInterpretation = finalInterpreterResult.output;
      interpreterInput.reviewerFindings = previousReview.findings;
    }
    finalInterpreterResult = await dispatch(
      'requirement-interpreter', interpreterInput, cycle
    );
    validateInterpretationTransition(finalInterpreterResult.output, interpreterInput);
    const reviewInput = { ticket, interpreterResult: finalInterpreterResult.output };
    if (previousReview) {
      reviewInput.previousReview = previousReview;
    }
    finalReviewResult = await dispatch('adversarial-reviewer', reviewInput, cycle);
    validateReview(finalReviewResult.output, reviewInput);
    const policy = deriveDisposition(finalInterpreterResult.output, finalReviewResult.output);
    reviewCycles.push({
      cycle,
      interpreterResult: finalInterpreterResult,
      reviewResult: finalReviewResult,
      ...policy
    });
    writeAuditEntry({
      correlationId,
      workflow: config.workflowName,
      agent: 'coordinator-governance',
      runtimeMode,
      cycle,
      status: 'REVIEW_VALIDATED',
      ...policy,
      timestamp: new Date().toISOString()
    }, auditFile);
    if (!finalReviewResult.output.findings.some(f =>
      f.severity === 'HIGH' && f.kind !== 'OPEN_AMBIGUITY'
    )) {
      break;
    }
  }
  const interpreterResult = reviewCycles[0].interpreterResult;
  const reviewResult = reviewCycles[0].reviewResult;

  // Human escalation gate.
  // Every branch below returns an explicit disposition or
  // records explicit governance reasoning; the workflow
  // never falls through to auto-approval.
  let humanGovernance = null;

  if (requiresHumanReview(assessmentFile)) {

    const decision =
      getLatestDecision(decisionsFile);

    if (!decision) {
      return punchOutResult(
        correlationId,
        'Human review required; no decision recorded.',
        'PUNCH_OUT',
        {},
        auditFile
      );
    }

    const validation =
      validateDecision(decision);

    if (!validation.valid) {
      return punchOutResult(
        correlationId,
        'Invalid human decision record. '
          + validation.reason,
        'PUNCH_OUT_INVALID_DECISION',
        { humanDecision: decision },
        auditFile
      );
    }

    if (
      isDecisionStale(
        decision,
        humanDecisionMaxAgeMs
      )
    ) {
      return punchOutResult(
        correlationId,
        'Human decision timed out or exceeded '
          + 'the maximum allowed age; '
          + 'fresh review required.',
        'PUNCH_OUT_DECISION_STALE',
        { humanDecision: decision },
        auditFile
      );
    }

    const normalized =
      validation.normalized;

    if (normalized === 'REJECT') {
      writeAuditEntry({
        correlationId,
        workflow: 'hvac-ticket-governance',
        agent: 'coordinator-human-gate',
        status: 'REJECTED_BY_HUMAN',
        reason:
          decision.reason
          || 'Rejected by human reviewer.',
        reviewer: decision.reviewer,
        humanDecision: decision,
        timestamp: new Date().toISOString()
      }, auditFile);

      return {
        correlationId,
        status: 'REJECTED_BY_HUMAN',
        disposition: 'REJECTED_BY_HUMAN',
        reason:
          decision.reason
          || 'Rejected by human reviewer.',
        humanDecision: decision
      };
    }

    // Explicit APPROVE / CONTINUE handling.
    humanGovernance = {
      status: 'HUMAN_APPROVED_CONTINUE',
      decision: normalized,
      reviewer: decision.reviewer,
      reason: decision.reason,
      timestamp: decision.timestamp
    };

    writeAuditEntry({
      correlationId,
      workflow: 'hvac-ticket-governance',
      agent: 'coordinator-human-gate',
      status: 'HUMAN_APPROVED_CONTINUE',
      reason:
        `Human ${normalized} honored: `
        + decision.reason,
      reviewer: decision.reviewer,
      humanDecision: decision,
      timestamp: new Date().toISOString()
    }, auditFile);
  }

  validateReview(finalReviewResult.output, {
    ticket,
    interpreterResult: finalInterpreterResult.output,
    ...(reviewCycles.length > 1
      ? { previousReview: reviewCycles[reviewCycles.length - 2].reviewResult.output }
      : {})
  });
  const { disposition, reasonCodes } = deriveDisposition(
    finalInterpreterResult.output, finalReviewResult.output
  );

  const finalReport =
    await dispatch(
      'final-review-writer',
      {
        interpreterResult: finalInterpreterResult.output,
        reviewResult: finalReviewResult.output,
        disposition,
        reasonCodes
      },
      reviewCycles.length
    );

  const totalPromptTokens = executedSteps.reduce(
    (sum, step) => sum + (step.audit?.promptTokens || 0),
    0
  );
  const totalCompletionTokens = executedSteps.reduce(
    (sum, step) => sum + (step.audit?.completionTokens || 0),
    0
  );
  const totalTokens = executedSteps.reduce(
    (sum, step) => sum + (step.audit?.totalTokens || 0),
    0
  );
  const totalCost = Number(
    executedSteps
      .reduce((sum, step) => sum + (step.audit?.cost || 0), 0)
      .toFixed(6)
  );

  return {
    correlationId,
    status: humanGovernance
      ? 'COMPLETED_AFTER_HUMAN_APPROVAL'
      : 'COMPLETED',
    disposition,
    reasonCodes,
    runtimeMode,
    reviewCycles,
    totalCost,
    humanGovernance,
    auditSummary: {
      model: finalReport.audit?.model,
      stepsExecuted: executedSteps.length,
      reDispatched: reviewCycles.length > 1,
      reviewCyclesExecuted: reviewCycles.length,
      reviewLimitReached: reviewCycles.length === maxReviewCycles
        && finalReviewResult.output.findings.some(f =>
          f.severity === 'HIGH' && f.kind !== 'OPEN_AMBIGUITY'
        ),
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCost,
      costMethod: finalReport.audit?.costMethod
    },
    interpreterResult,
    reviewResult,
    finalInterpreterResult,
    finalReviewResult,
    finalReport
  };
}

async function executeWorkflow(ticket, options = {}) {
  const correlationId = generateCorrelationId();
  try {
    const result = await executeWorkflowSteps(ticket, { ...options, correlationId });
    return { runtimeMode: options.runtimeMode || config.runtimeMode, ...result };
  } catch (error) {
    const result = {
      correlationId,
      status: error.code || 'WORKFLOW_FAILURE',
      disposition: 'FAIL',
      runtimeMode: options.runtimeMode || config.runtimeMode,
      reason: error.code ? error.message : 'Workflow execution failed.'
    };
    writeAuditEntry({
      ...result,
      workflow: config.workflowName,
      agent: 'coordinator-governance',
      timestamp: new Date().toISOString()
    }, options.auditFile || config.auditFile);
    return result;
  }
}

module.exports = {
  executeWorkflow,
  allowedTools: coordinatorTools.tools,
  launch_requirement_interpreter,
  launch_adversarial_reviewer,
  launch_final_review_writer
};