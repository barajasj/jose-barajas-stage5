module.exports = {
  'requirement-interpreter': {
    promptFile: 'agents/requirement-interpreter.md',
    schemaFile: 'schemas/examiner.schema.json',
    model: 'swe-1.7'
  },

  'adversarial-reviewer': {
    promptFile: 'agents/adversarial-reviewer.md',
    schemaFile: 'schemas/challenges.schema.json',
    model: 'swe-1.7'
  },

  'final-review-writer': {
    promptFile: 'agents/final-review-writer.md',
    schemaFile: 'schemas/final-review.schema.json',
    model: 'swe-1.7'
  }
};