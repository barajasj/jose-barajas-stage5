module.exports = {
  'requirement-interpreter': {
    promptFile: 'agents/requirement-interpreter.md',
    schemaFile: 'schemas/examiner.schema.json',
    model: 'accounts/fireworks/models/gpt-oss-120b',
    requiredInputs: ['ticket'],
    allowedInputs: ['ticket', 'previousInterpretation', 'reviewerFindings'],
    isolatedContext: true,
    allowedTools: []
  },

  'adversarial-reviewer': {
    promptFile: 'agents/adversarial-reviewer.md',
    schemaFile: 'schemas/challenges.schema.json',
    model: 'accounts/fireworks/models/gpt-oss-120b',
    requiredInputs: ['ticket', 'interpreterResult'],
    allowedInputs: ['ticket', 'interpreterResult', 'previousReview'],
    isolatedContext: true,
    allowedTools: []
  },

  'final-review-writer': {
    promptFile: 'agents/final-review-writer.md',
    schemaFile: 'schemas/final-review.schema.json',
    model: 'accounts/fireworks/models/gpt-oss-120b',
    requiredInputs: ['interpreterResult', 'reviewResult', 'disposition', 'reasonCodes'],
    allowedInputs: ['interpreterResult', 'reviewResult', 'disposition', 'reasonCodes'],
    isolatedContext: true,
    allowedTools: []
  }
};