const fs = require('fs');

const ALLOWED_DECISIONS = [
  'APPROVE',
  'CONTINUE',
  'REJECT'
];

function loadHumanDecisions(
  decisionsFile = 'human-decisions.jsonl'
) {

  if (!fs.existsSync(decisionsFile)) {
    return [];
  }

  const lines =
    fs.readFileSync(
      decisionsFile,
      'utf8'
    )
    .split('\n')
    .filter(Boolean);

  return lines.map(line =>
    JSON.parse(line)
  );
}

function getLatestDecision(
  decisionsFile = 'human-decisions.jsonl'
) {

  const decisions = loadHumanDecisions(
    decisionsFile
  );

  if (!decisions.length) {
    return null;
  }

  return decisions[
    decisions.length - 1
  ];
}

function validateDecision(decision) {

  if (!decision || typeof decision !== 'object') {
    return {
      valid: false,
      reason:
        'Human decision record is missing or malformed.'
    };
  }

  const normalized =
    typeof decision.decision === 'string'
      ? decision.decision.trim().toUpperCase()
      : null;

  if (
    !normalized ||
    !ALLOWED_DECISIONS.includes(normalized)
  ) {
    return {
      valid: false,
      reason:
        `Unrecognized human decision value: `
        + `${decision.decision}. `
        + `Allowed values: `
        + ALLOWED_DECISIONS.join(', ')
        + '.'
    };
  }

  if (
    normalized === 'APPROVE' ||
    normalized === 'CONTINUE'
  ) {
    if (
      typeof decision.reviewer !== 'string' ||
      !decision.reviewer.trim()
    ) {
      return {
        valid: false,
        reason:
          'APPROVE/CONTINUE decision is missing '
          + 'reviewer identity.'
      };
    }

    if (
      typeof decision.reason !== 'string' ||
      !decision.reason.trim()
    ) {
      return {
        valid: false,
        reason:
          'APPROVE/CONTINUE decision is missing '
          + 'a documented reason.'
      };
    }
  }

  return {
    valid: true,
    normalized
  };
}

function isDecisionStale(
  decision,
  maxAgeMs,
  now = Date.now()
) {

  if (!maxAgeMs) {
    return false;
  }

  const decidedAt = Date.parse(
    decision.timestamp
  );

  if (Number.isNaN(decidedAt)) {
    return true;
  }

  return (now - decidedAt) > maxAgeMs;
}

module.exports = {
  getLatestDecision,
  validateDecision,
  isDecisionStale,
  ALLOWED_DECISIONS
};
