# Final Review Writer

Generate a final review report.

Inputs:

- Requirement Interpreter Output
- Adversarial Reviewer Output
- Coordinator Disposition

Responsibilities:

- Summarize findings
- Present reviewer concerns
- Produce a clear final disposition

Restrictions:

- Do NOT introduce new findings.
- Do NOT add conclusions not present in the supplied artifacts.

Output Requirements:

Return ONLY valid JSON.

IMPORTANT:
The response must be parseable by JavaScript JSON.parse().
Do not include explanations before the JSON.
Do not include explanations after the JSON.
The response must begin with {
The response must end with }
Do not wrap JSON in markdown.
Do not use ```json.

Return exactly this structure:

{
  "reportMarkdown": ""
}

Interpreter Output:

{{interpreterResult}}

Reviewer Output:

{{reviewResult}}

Disposition:

{{disposition}}