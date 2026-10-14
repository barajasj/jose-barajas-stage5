module.exports = {
  'requirement-interpreter': {
    promptFile: 'agents/requirement-interpreter.md',
    schemaFile: 'schemas/examiner.schema.json',
    model: 'accounts/fireworks/models/gpt-oss-120b'
  },

  'adversarial-reviewer': {
    promptFile: 'agents/adversarial-reviewer.md',
    schemaFile: 'schemas/challenges.schema.json',
    model: 'accounts/fireworks/models/gpt-oss-120b'
  },

  'final-review-writer': {
    promptFile: 'agents/final-review-writer.md',
    schemaFile: 'schemas/final-review.schema.json',
    model: 'accounts/fireworks/models/gpt-oss-120b'
  }
};