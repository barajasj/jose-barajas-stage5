function buildPrompt(
  template,
  variables
) {

  let prompt = template.replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
    if (!Object.hasOwn(variables, key)) {
      throw new Error(`Missing prompt input: ${key}`);
    }
    const value = variables[key];
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
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
    prompt += `\n\nReview cycle ${variables.reviewCycle || 1}. Adversarial Reviewer Findings (address actionable HIGH interpretation defects without inventing unsupported requirements; preserve missing ticket facts as ambiguities):\n${JSON.stringify(
      variables.reviewerFindings,
      null,
      2
    )}`;
  }

  if (variables.previousInterpretation) {
    prompt += '\n\nPreserve each previous ambiguity verbatim unless the original ticket explicitly answers it. For each removed ambiguity, return ambiguityResolutions with ambiguity (exact previous text), rationale, and sourceQuote (an exact nonempty ticket quotation). Do not erase an unanswered question or choose missing business policy to obtain PASS.';
  }

  return prompt;
}

module.exports = {
  buildPrompt
};