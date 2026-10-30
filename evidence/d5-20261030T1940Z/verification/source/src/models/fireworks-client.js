require('dotenv').config({ quiet: true });

const OpenAI = require('openai');

async function invokeLlm({
  prompt,
  model,
  temperature = 0
}) {
  const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: 'https://api.fireworks.ai/inference/v1'
  });

  const response =
    await client.chat.completions.create({
      model,
      temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

  return {
    content: response.choices?.[0]?.message?.content || '',
    promptTokens: response.usage?.prompt_tokens || 0,
    completionTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0
  };
}

module.exports = {
  invokeLlm
};