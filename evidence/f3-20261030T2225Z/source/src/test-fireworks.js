const {
  invokeLlm
} = require('./models/fireworks-client');

async function main() {

  const result =
    await invokeLlm({
      model:
        'accounts/fireworks/models/gpt-oss-120b',

      prompt:
        'Reply with exactly: Fireworks connection successful'
    });

  console.log(
    JSON.stringify(result, null, 2)
  );
}

main().catch(console.error);