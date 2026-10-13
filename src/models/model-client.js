async function invokeModel({
  prompt,
  model
}) {
  return {
    content: '',
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0
  };
}

module.exports = {
  invokeModel
};