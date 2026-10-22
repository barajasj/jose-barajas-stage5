const { runAgent } = require('./agent-runner');
const { generateCorrelationId } = require('./correlation-id');
const coordinatorTools = require('../coordinator/coordinator-tools.json');

const {
  requiresHumanReview
} = require('./substance-gate');

const {
  getLatestDecision
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

async function executeWorkflow(ticket) {
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

  // Human escalation gate
  if (requiresHumanReview()) {

    const decision =
      getLatestDecision();

    if (!decision) {
      return {
        correlationId,
        status: 'PUNCH_OUT',
        reason:
          'Human review required.'
      };
    }

    if (
      decision.decision === 'REJECT'
    ) {
      return {
        correlationId,
        status: 'REJECTED_BY_HUMAN'
      };
    }
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
    disposition,
    totalCost,
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