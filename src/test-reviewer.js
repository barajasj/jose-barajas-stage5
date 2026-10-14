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

  const ticket =
    fs.readFileSync(
      'fixtures/hvac-ticket-1.md',
      'utf8'
    );

  //
  // Step 1 - Run Requirement Interpreter
  //
  const interpreterTemplate =
    loadPrompt(
      'agents/requirement-interpreter.md'
    );

  const interpreterPrompt =
    buildPrompt(
      interpreterTemplate,
      { ticket }
    );

  const interpreterResponse =
    await invokeLlm({
      model:
        'accounts/fireworks/models/gpt-oss-120b',
      prompt: interpreterPrompt
    });

  const interpreterResult =
    JSON.parse(
      interpreterResponse.content
    );

  //
  // Step 2 - Run Adversarial Reviewer
  //
  const reviewerTemplate =
    loadPrompt(
      'agents/adversarial-reviewer.md'
    );

  const reviewerPrompt =
    buildPrompt(
      reviewerTemplate,
      {
        ticket,
        interpreterResult
      }
    );

  const reviewerResponse =
    await invokeLlm({
      model:
        'accounts/fireworks/models/gpt-oss-120b',
      prompt: reviewerPrompt
    });

  console.log(
    reviewerResponse.content
  );
}

main().catch(console.error);