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

  return prompt;
}

module.exports = {
  buildPrompt
};