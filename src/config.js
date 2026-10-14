module.exports = {
  workflowName: 'hvac-ticket-governance',
  model: 'accounts/fireworks/models/gpt-oss-120b',
  pricing: {
    inputPerMillion: 0.50,
    outputPerMillion: 2.50
  },
  maxReviewCycles: 2,

  runtimeMode: process.env.RUNTIME_MODE || 'mock'
};