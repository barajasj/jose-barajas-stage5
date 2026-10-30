require('dotenv').config();

const fs = require('fs');

const {
  invokeLlm
} = require('./models/fireworks-client');

const {
  loadPrompt
} = require('./prompt-loader');

const {
  buildPrompt
} = require('./prompt-builder');

async function main() {

  const interpreterResult =
    require('../runs/sample-interpreter-output.json');

  const reviewResult =
    require('../runs/sample-reviewer-output.json');

  const template =
    loadPrompt(
      'agents/final-review-writer.md'
    );

  const prompt =
    buildPrompt(
      template,
      {
        interpreterResult,
        reviewResult,
        disposition: 'FAIL'
      }
    );

  const response =
    await invokeLlm({
      model:
        'accounts/fireworks/models/gpt-oss-120b',
      prompt
    });

  console.log(response.content);
}

main().catch(console.error);