const { validateSchema } =
  require('./schema-validator');

const reviewerOutput =
  require('../runs/sample-reviewer-output.json');

const result =
  validateSchema(
    reviewerOutput,
    './schemas/challenges.schema.json'
  );

console.log(
  JSON.stringify(result, null, 2)
);