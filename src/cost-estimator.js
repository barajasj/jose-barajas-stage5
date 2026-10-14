function estimateCost(
  promptTokens,
  completionTokens
) {
  const inputCost = (promptTokens / 1_000_000) * 0.5;

  const outputCost = (completionTokens / 1_000_000) * 2.5;

  return Number(
    (inputCost + outputCost)
      .toFixed(6)
  );
}

module.exports = {
  estimateCost
};