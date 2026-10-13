module.exports = {
  workflowName: 'hvac-ticket-governance',
  model: 'swe-1.7',
  maxReviewCycles: 2,

  runtimeMode:
    process.env.RUNTIME_MODE || 'mock'
};