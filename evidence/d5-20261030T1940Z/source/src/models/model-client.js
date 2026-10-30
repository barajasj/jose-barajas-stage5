const config = require('../config');

async function invokeModel({
  prompt,
  model
}) {

  if (
    config.runtimeMode === 'mock'
  ) {
    throw new Error(
      'Model invocation should not occur in mock mode.'
    );
  }

  throw new Error(
    'gpt-oss-120b integration not implemented yet.'
  );
}

module.exports = {
  invokeModel
};