const fs = require('fs');
const Ajv = require('ajv');

const ajv = new Ajv();

function validateSchema(data, schemaPath) {
  const schema = JSON.parse(
    fs.readFileSync(schemaPath, 'utf8')
  );

  const validate = ajv.compile(schema);

  const valid = validate(data);

  return {
    valid,
    errors: validate.errors || []
  };
}

module.exports = {
  validateSchema
};