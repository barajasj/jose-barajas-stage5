const config = require('./config');

function estimateCost(
  promptTokens,
  completionTokens
) {
  const inputCost = (promptTokens / 1_000_000) * config.pricing.inputPerMillion;

  const outputCost = (completionTokens / 1_000_000) * config.pricing.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(6));
}

module.exports = {
  estimateCost
};