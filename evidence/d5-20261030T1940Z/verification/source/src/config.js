module.exports = {
  workflowName: 'hvac-ticket-governance',
  model: 'accounts/fireworks/models/gpt-oss-120b',
  pricing: {
    inputPerMillion: 0.50,
    outputPerMillion: 2.50
  },
  maxReviewCycles: Number(process.env.MAX_REVIEW_CYCLES || 2),

  runtimeMode: process.env.RUNTIME_MODE || 'mock',
  runsDir: process.env.RUNS_DIR || 'runs',
  auditFile: process.env.AUDIT_FILE || 'audit/audit-log.jsonl'
};