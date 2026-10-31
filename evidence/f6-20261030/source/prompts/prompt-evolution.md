# Prompt Evolution

## F6 Prospective Ledger - Pending Live Measurement

F6 introduces a reproducible prospective experiment, not reconstructed history.
No F6 provider calls have run yet; no new improvement delta is claimed.
Protocol and commands: `docs/F6-MEASUREMENT.md`.

| Agent | Version | Reason For Change | Measured Outcome | Evidence Location |
|---|---|---|---|---|
| Requirement Interpreter | v0 | Unchanged post-F3 baseline | Pending | Planned `evidence/f6-20261030/v0/` |
| Requirement Interpreter | v1 | Separate explicit extraction, unanswered policy, and grounded implementation consequences | Pending | `evals/f6-iterations.js`; planned `evidence/f6-20261030/prompts/v1/` and `v1/` |
| Requirement Interpreter | v2 | Audit numeric/configuration omissions, speculative rules, and redispatch identity after v1 | Pending | `evals/f6-iterations.js`; planned `evidence/f6-20261030/prompts/v2/` and `v2/` |
| Adversarial Reviewer | v0 | Unchanged post-F3 baseline | Pending | Planned `evidence/f6-20261030/v0/` |
| Adversarial Reviewer | v1 | Compare against the whole interpretation and establish the precise supported defect before citation | Pending | `evals/f6-iterations.js`; planned `evidence/f6-20261030/prompts/v1/` and `v1/` |
| Adversarial Reviewer | v2 | Audit finding support/severity, pointer identity, ambiguity coverage, and prior IDs after v1 | Pending | `evals/f6-iterations.js`; planned `evidence/f6-20261030/prompts/v2/` and `v2/` |
| Final Review Writer | v0 | Unchanged post-F3 baseline | Pending | Planned `evidence/f6-20261030/v0/` |
| Final Review Writer | v1 | Transcribe opaque template characters with one outer JSON encoding instead of regenerating prose | Pending | `evals/f6-iterations.js`; planned `evidence/f6-20261030/prompts/v1/` and `v1/` |
| Final Review Writer | v2 | Compare decoded characters and audit backslashes, embedded quotes, and conjunctions after v1 | Pending | `evals/f6-iterations.js`; planned `evidence/f6-20261030/prompts/v2/` and `v2/` |

Planned comparisons: v0->v1 and v1->v2 on the same 28 fixed inputs, frozen corrected
scorer/labels/contracts/model/settings, one observation per case/version. Raw
rejections and failed/interrupted attempts remain discoverable. Zero/negative
changes must be reported, never relabeled improvement. Candidates are not
automatically deployed. Existing historical claims remain withdrawn below.

## Current Evidence Qualification - 2026-10-30

The live batch in `evidence/d5-20261030T1940Z/` changed no prompts. It establishes
neither a prompt-improvement delta nor two measured prompt-change cycles per agent.
All 26 direct cases were measured against unchanged fixed labels; only two writer
cases passed strict scoring. One of five workflows completed, with disposition FAIL.
All attempts, including failures and the unsuccessful positive control, are retained.

Historical baseline exports are original `4fcbf47` bytes and do not satisfy current
status/cycle/provenance contracts. Old keyword scores cannot be compared with
content-v2 scores as measured prompt improvement. Re-dispatch is not a reviewer
prompt edit, and deterministic heading code is not writer prompt evolution.

The historical narratives below remain for traceability only. Their deltas,
21-success claim, and iteration counts are not revalidated certification evidence.
See `diagnostics.json` and the current sections in `evals/*-eval.md`.

## Historical Iteration Narratives

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
