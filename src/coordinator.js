const { runAgent } = require('./agent-runner');
const { generateCorrelationId } = require('./correlation-id');
const { writeAuditEntry } = require('./audit-logger');
const coordinatorTools = require('../coordinator/coordinator-tools.json');

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

function assembleDeterministicHeading(reportMarkdown, disposition) {
  const trimmed = (reportMarkdown || '').trim();
  const expectedHeading = `# ${disposition}`;
  if (trimmed.startsWith(expectedHeading)) {
    return trimmed;
  }
  return `${expectedHeading}\n\n${trimmed}`;
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
  extra = {}
) {

  writeAuditEntry({
    correlationId,
    workflow: 'hvac-ticket-governance',
    agent: 'coordinator-human-gate',
    status: auditStatus,
    reason,
    timestamp: new Date().toISOString()
  });

  return {
    correlationId,
    status: 'PUNCH_OUT',
    disposition: 'PUNCH_OUT',
    reason,
    ...extra
  };
}

async function executeWorkflow(
  ticket,
  options = {}
) {
  const {
    assessmentFile = DEFAULT_ASSESSMENT_FILE,
    decisionsFile = DEFAULT_DECISIONS_FILE,
    humanDecisionMaxAgeMs = HUMAN_DECISION_MAX_AGE_MS
  } = options;

  const correlationId = generateCorrelationId();
  const executedSteps = [];

  const interpreterResult =
    await launch_requirement_interpreter(
      {
        ticket
      },
      correlationId
    );
  executedSteps.push(interpreterResult);

  const reviewResult =
    await launch_adversarial_reviewer(
      {
        ticket,
        interpreterResult: interpreterResult.output
      },
      correlationId
    );
  executedSteps.push(reviewResult);

  const hasHighSeverityFinding =
    reviewResult.output.findings?.some(
      finding => finding.severity === 'HIGH'
    );

  let finalInterpreterResult =
    interpreterResult;

  let finalReviewResult =
    reviewResult;

  if (hasHighSeverityFinding) {

    console.error(
      'HIGH severity finding detected. Re-dispatching...'
    );

    finalInterpreterResult =
      await launch_requirement_interpreter(
        {
          ticket,
          previousInterpretation:
            interpreterResult.output,
          reviewerFindings:
            reviewResult.output.findings
        },
        correlationId
      );
    executedSteps.push(finalInterpreterResult);

    finalReviewResult =
      await launch_adversarial_reviewer(
        {
          ticket,
          interpreterResult:
            finalInterpreterResult.output
        },
        correlationId
      );
    executedSteps.push(finalReviewResult);
  }

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
        'PUNCH_OUT'
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
        { humanDecision: decision }
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
        { humanDecision: decision }
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
      });

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
    });
  }

  const disposition = finalReviewResult.output.status;

  const finalReport =
    await launch_final_review_writer(
      {
        interpreterResult: finalInterpreterResult.output,
        reviewResult: finalReviewResult.output,
        disposition
      },
      correlationId
    );

  finalReport.output.reportMarkdown =
    assembleDeterministicHeading(
      finalReport.output.reportMarkdown,
      disposition
    );

  executedSteps.push(finalReport);

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
    totalCost,
    humanGovernance,
    auditSummary: {
      model: finalReport.audit?.model,
      stepsExecuted: executedSteps.length,
      reDispatched: Boolean(hasHighSeverityFinding),
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

module.exports = {
  executeWorkflow,
  allowedTools: coordinatorTools.tools,
  launch_requirement_interpreter,
  launch_adversarial_reviewer,
  launch_final_review_writer
};