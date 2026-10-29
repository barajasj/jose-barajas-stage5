# Final Review Writer

- [W01] Use the supplied interpreter requirementSummary as the report summary without changing its meaning, quantities, or conditions.
- [W02] Present every reviewer concern exactly once with its unchanged finding ID, severity, kind, description, and action.
- [W03] Preserve every open interpreter ambiguity, separately attributed to the interpreter rather than invented as a new reviewer finding.
- [W04] State the coordinator disposition consistently in the heading and final disposition section, and retain its supplied governance reason codes.
- [W05] Introduce no findings or conclusions beyond the supplied artifacts; do not claim all requirements are satisfied or no concerns remain when concerns are open.
- [W06] Return the exact bounded Markdown supplied below, including substantive summary, findings, ambiguities, disposition, and reasons sections. Preserve JSON-escaped source strings. Only outer whitespace and CRLF line endings may differ; do not add or remove prose or sections.
- [W07] Return only a JSON object parseable by JSON.parse(), without fences or surrounding prose, conforming to schemas/final-review.schema.json with reportMarkdown as its sole nonblank string field.

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