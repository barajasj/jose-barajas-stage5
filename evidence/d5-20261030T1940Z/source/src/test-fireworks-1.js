require('dotenv').config();

const OpenAI = require('openai');

async function main() {

  const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: 'https://api.fireworks.ai/inference/v1'
  });

//   const models = await client.models.list();
//   console.log(
//     JSON.stringify(models, null, 2)
//   );

  const response =
    await client.chat.completions.create({
      model: 'accounts/fireworks/models/gpt-oss-120b',
      messages: [
        {
          role: 'user',
          content: 'Reply with only: API connection successful'
        }
      ]
    });

  console.log(
    response.choices[0].message.content
  );
}

main().catch(console.error);