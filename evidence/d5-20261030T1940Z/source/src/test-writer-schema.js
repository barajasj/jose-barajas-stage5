const { validateSchema } =
  require('./schema-validator');

const writerOutput =
  require('../runs/sample-writer-output.json');

const result =
  validateSchema(
    writerOutput,
    './schemas/final-review.schema.json'
  );

console.log(
  JSON.stringify(result, null, 2)
);