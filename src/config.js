module.exports = {
  workflowName: 'hvac-ticket-governance',
  model: 'accounts/fireworks/models/gpt-oss-120b',
  maxReviewCycles: 2,

  runtimeMode: process.env.RUNTIME_MODE || 'mock'
};