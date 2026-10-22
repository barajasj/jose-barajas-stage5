function buildPrompt(
  template,
  variables
) {

  let prompt = template;

  Object.entries(variables)
    .forEach(([key, value]) => {

      prompt =
        prompt.replaceAll(
          `{{${key}}}`,
          typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2)
        );

    });

  if (
    variables.previousInterpretation &&
    !template.includes('{{previousInterpretation}}')
  ) {
    prompt += `\n\nPrevious Interpretation:\n${JSON.stringify(
      variables.previousInterpretation,
      null,
      2
    )}`;
  }

  if (
    variables.reviewerFindings &&
    !template.includes('{{reviewerFindings}}')
  ) {
    prompt += `\n\nAdversarial Reviewer Findings (address all HIGH severity challenges without inventing unsupported requirements):\n${JSON.stringify(
      variables.reviewerFindings,
      null,
      2
    )}`;
  }

  return prompt;
}

module.exports = {
  buildPrompt
};