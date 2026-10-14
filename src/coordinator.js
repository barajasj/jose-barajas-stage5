const { runAgent } = require('./agent-runner');
const { generateCorrelationId } = require('./correlation-id');

const {
  requiresHumanReview
} = require('./substance-gate');

const {
  getLatestDecision
} = require('./human-review');

async function executeWorkflow(ticket) {
  const correlationId = generateCorrelationId();

  const interpreterResult =
    await runAgent(
      'requirement-interpreter',
      {
        ticket
      },
      correlationId
    );

  const reviewResult =
    await runAgent(
      'adversarial-reviewer',
      {
        ticket,
        interpreterResult
      },
      correlationId
    );

  const hasHighSeverityFinding =
    reviewResult.output.findings?.some(
      finding => finding.severity === 'HIGH'
    );

  let finalInterpreterResult =
    interpreterResult;

  let finalReviewResult =
    reviewResult;

  if (hasHighSeverityFinding) {

    console.log(
      'HIGH severity finding detected. Re-dispatching...'
    );

    finalInterpreterResult =
      await runAgent(
        'requirement-interpreter',
        {
          ticket,
          previousInterpretation:
            interpreterResult.output,
          reviewerFindings:
            reviewResult.output.findings
        },
        correlationId
      );

    finalReviewResult =
      await runAgent(
        'adversarial-reviewer',
        {
          ticket,
          interpreterResult:
            finalInterpreterResult.output
        },
        correlationId
      );
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

  const finalReport =
    await runAgent(
      'final-review-writer',
      {
        interpreterResult:
          finalInterpreterResult,
        reviewResult:
          finalReviewResult
      },
      correlationId
    );

  return {
    correlationId,
    interpreterResult,
    reviewResult,
    finalInterpreterResult,
    finalReviewResult,
    finalReport
  };
}

module.exports = {
  executeWorkflow
};