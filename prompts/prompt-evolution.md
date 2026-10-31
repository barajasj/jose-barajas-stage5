# Prompt Evolution

## F6 Measured Ledger - 2026-10-30

84 authorized real-model calls measured v0->v1->v2 on 28 fixed inputs. Both
cycles have 28 strictly eligible pairs and no unmatched cases. All observations,
including five runtime rejections, are retained; no retries or repairs occurred.
Scorer: `content-v3-reviewed-equivalents`, SHA-256
`08218b2c6568063db18d49c68d07c72b3c064b8cde296675438ce5f7ba582a76`.
Neither labels nor runtime contracts changed during collection.

Protocol: `docs/F6-MEASUREMENT.md`. Full results and all positive/negative deltas:
[`MEASURED-SUMMARY.md`](../evidence/f6-20261030/MEASURED-SUMMARY.md).
Machine ledger (exact hashes, added instructions, results, and deltas):
[`prompt-evolution-ledger.json`](../evidence/f6-20261030/prompt-evolution-ledger.json).
Exact six prompt diffs: `evidence/f6-20261030/prompt-diffs/`.

| Agent | Version | Reason For Change | Measured Outcome | Evidence Location |
|---|---|---|---|---|
| Requirement Interpreter | v0 | Unchanged post-F3 baseline | Strict 0/8; runtime 8/8; confidence-policy 7/8; extraction 6/39 | [v0 attempts](../evidence/f6-20261030/v0/attempts.json); `prompts/v0/requirement-interpreter.md` in package |
| Requirement Interpreter | v1 | Separate explicit extraction, unanswered policy, and grounded implementation consequences | Strict 0/8; runtime 8/8; confidence 8/8 (+12.5 pp); terminology 40/49 (+4.08 pp); extraction 5/39 (-2.56 pp) | [v1 attempts](../evidence/f6-20261030/v1/attempts.json); `prompts/v1/requirement-interpreter.md` in package |
| Requirement Interpreter | v2 | Audit numeric/configuration omissions, speculative rules, and redispatch identity after v1 | Strict 0/8; runtime 8/8; confidence 8/8 (0 pp); terminology 39/49 (-2.04 pp); extraction 3/39 (-5.13 pp) | [v2 attempts](../evidence/f6-20261030/v2/attempts.json); `prompts/v2/requirement-interpreter.md` in package |
| Adversarial Reviewer | v0 | Unchanged post-F3 baseline | Strict 0/16; runtime 15/16 | [v0 attempts](../evidence/f6-20261030/v0/attempts.json); `prompts/v0/adversarial-reviewer.md` in package |
| Adversarial Reviewer | v1 | Compare against the whole interpretation and establish the precise supported defect before citation | Strict 0/16; runtime 16/16 (+6.25 pp); bounded false-positive gate 5/16 (+12.5 pp) | [v1 attempts](../evidence/f6-20261030/v1/attempts.json); `prompts/v1/adversarial-reviewer.md` in package |
| Adversarial Reviewer | v2 | Audit finding support/severity, pointer identity, ambiguity coverage, and prior IDs after v1 | Strict 0/16; runtime 14/16 (-12.5 pp); two invalid source quotations; no promotion | [v2 attempts](../evidence/f6-20261030/v2/attempts.json); `prompts/v2/adversarial-reviewer.md` in package |
| Final Review Writer | v0 | Unchanged post-F3 baseline | Strict/runtime 3/4; ticket-4 nested escaping rejected | [v0 attempts](../evidence/f6-20261030/v0/attempts.json); `prompts/v0/final-review-writer.md` in package |
| Final Review Writer | v1 | Transcribe opaque template characters with one outer JSON encoding instead of regenerating prose | Strict/runtime 3/4 (0 pp); same nested-escaping failure retained | [v1 attempts](../evidence/f6-20261030/v1/attempts.json); `prompts/v1/final-review-writer.md` in package |
| Final Review Writer | v2 | Compare decoded characters and audit backslashes, embedded quotes, and conjunctions after v1 | Strict/runtime 4/4 (+25 pp); preservation 4/4, completeness 14/14, output quality 16/16 | [v2 attempts](../evidence/f6-20261030/v2/attempts.json); `prompts/v2/final-review-writer.md` in package |

Deltas are versus the immediately preceding version; full-precision decisions
remain in JSON. These are two measured change cycles per agent, not two successful
improvements per agent. Each agent has a positive observation in one cycle; mixed
and negative outcomes remain visible. Strict bounded-label scores are not
general semantic-accuracy estimates. No production prompt was promoted.
Single observations on a development suite do not establish causal improvement,
repeat-run reliability, or certification PASS. Historical claims stay withdrawn.

## Preserved Deliverable 5 Qualification - 2026-10-30

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
Coordinator re-dispatch loop plus `-pass1.json` snapshots
(harness-side; no reviewer prompt wording changed, so this is not
prompt evolution). Attribution matches `evals/adversarial-reviewer-eval.md`.

Measured (historical keyword scorer; baseline pooled tickets 1-3,
final pooled tickets 1-4; on matched tickets 1-3 it is 0.250 -> 1.000):
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
Structured-output success 0% -> subsequent runs parsed. The earlier
"21" and "52" consecutive-SUCCESS counts conflict and are withdrawn;
the append-only audit log is the only source for counts.

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
