require('dotenv').config();

const fs = require('fs');

const { invokeLlm } =
  require('./models/fireworks-client');

const { loadPrompt } =
  require('./prompt-loader');

const { buildPrompt } =
  require('./prompt-builder');

async function main() {

  const ticket =
    fs.readFileSync(
      'fixtures/hvac-ticket-1.md',
      'utf8'
    );

  const template =
    loadPrompt(
      'agents/requirement-interpreter.md'
    );

  const prompt =
    buildPrompt(
      template,
      { ticket }
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