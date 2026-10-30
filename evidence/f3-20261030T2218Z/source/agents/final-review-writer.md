# Final Review Writer

- [W01] Use the supplied interpreter requirementSummary as the report summary without changing its meaning, quantities, or conditions.
- [W02] Present every reviewer concern exactly once with its unchanged finding ID, severity, kind, description, and action.
- [W03] Preserve every open interpreter ambiguity, separately attributed to the interpreter rather than invented as a new reviewer finding.
- [W04] State the coordinator disposition consistently in the heading and final disposition section, and retain its supplied governance reason codes.
- [W05] Introduce no findings or conclusions beyond the supplied artifacts; do not claim all requirements are satisfied or no concerns remain when concerns are open.
- [W06] Copy the bounded reportTemplate supplied below as the parsed value of reportMarkdown, including every section, character, finding, ambiguity, disposition, and reason. The template already contains Markdown text; do not paraphrase it, correct it, normalize quotes, or remove backslashes. Encode that value only as required for the outer JSON object, so JSON.parse() of your response produces the original template text. Only outer whitespace and CRLF line endings may differ; do not add or remove report content or sections.
- [W07] Return only a JSON object parseable by JSON.parse(), without fences or surrounding prose, conforming to schemas/final-review.schema.json with reportMarkdown as its sole nonblank string field.
- [W08] Worked nested-escaping fragment, not a complete report; always return the entire supplied template. Template fragment: `- /ambiguities/0 | "Select 3/8\" tube with 1\" spacing."`. Correct JSON fragment: `{"reportMarkdown":"- /ambiguities/0 | \"Select 3/8\\\" tube with 1\\\" spacing.\""}`. Parsing this JSON once preserves the template's literal backslashes before the inch marks; do not decode the JSON strings embedded inside the Markdown.
- [W09] Worked verbatim-wording fragment, not a complete report. Template fragment: `"No rounding or precision rules are specified for the sum of heights."`. Correct JSON fragment: `{"reportMarkdown":"\"No rounding or precision rules are specified for the sum of heights.\""}`. Preserve "or"; changing it to "and" is invalid even if it sounds natural. Copy the actual template, not these illustrative fragments.

## Interpreter Output

{{interpreterResult}}

## Reviewer Output

{{reviewResult}}

## Disposition

{{disposition}}

## Governance Reasons

{{reasonCodes}}

## Required Report Markdown:

{{reportTemplate}}