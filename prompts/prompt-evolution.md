# Prompt Evolution

Iteration 1

Issue:
Requirements were summarized but ambiguities were often missed.

Improvement:
Added explicit ambiguity detection instructions.

Measured:
`ambiguityDetection` baseline 0.500 ->
final 1.000 (+0.500), scored by
`node src/run-evals.js` against
`evidence/run1` (baseline, commit `4fcbf47`)
vs `evidence` (final) artifacts.

---

Iteration 2

Issue:
HVAC terminology was occasionally omitted.

Improvement:
Added dedicated HVAC terminology section.

Measured:
`hvacTerminologyRecognition` baseline
0.864 -> final 1.000 (+0.136).

---

Iteration 3

Issue:
Reviewer findings were too generic.

Improvement:
Added requirement to produce actionable challenges.

Measured:
`missingRequirementDetection` baseline
0.250 -> final 0.727 (+0.477). Remaining
gap driven by ticket-4 PASS verdict; see
`evals/adversarial-reviewer-eval.md`.

---

Iteration 4

Issue:
Reviewer emitted markdown instead of JSON,
causing `JSON_PARSE_FAILURE` at
HVAC-TICKET-1791999987142 and halting the
workflow at the schema guardrail.

Improvement:
Added strict JSON output requirements and
the exact output structure to all three
agent prompts.

Measured:
Structured-output success 0% ->
21 consecutive SUCCESS entries in
`audit/audit-log.jsonl` after the change.

---

Iteration 5

Issue:
Final reports did not always open with the
deterministic `# <DISPOSITION>` heading.

Improvement:
Coordinator-side
`assembleDeterministicHeading()` in
`src/coordinator.js` normalizes the
heading after generation.

Measured:
`outputQuality` (final-review-writer)
baseline 0.667 -> final 1.000 (+0.333).
