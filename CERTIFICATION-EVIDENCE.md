# Stage 5 Evidence Index

## F3 Runtime Follow-Up - 2026-10-30

F3-only report: `evidence/f3-20261030T2225Z/F3-REPORT.md`.
Both original batches and subsequent Ticket 2 follow-ups are retained:
`evidence/f3-ticket2-20261030T2247Z/F3-TICKET2-FOLLOWUP.md` and
`evidence/f3-ticket2-redispatch-20261030T2250Z/REDISPATCH-PROBE.md`.
After the Ticket 2 workflow rerun, completion is 8/11 (72.7%) over all new
workflow attempts, 5/6 (83.3%) over the latest cohort plus rerun, versus original
1/5 (20%). Ticket 2 has completed 2/3 attempts. The rerun completed in one cycle,
so it did not itself exercise redispatch. A separate direct probe replayed the
preserved failing cycle-2 input: exact prior ambiguity identity passed; one
ticket-answered ambiguity was removed, five unanswered ambiguities were retained.
The probe is not counted as a workflow. All completed reports remain FAIL,
including the positive control; this does not establish semantic accuracy, F4
closure, or certification readiness. F6 remains untouched; original package unchanged.

## Current Evidence - 2026-10-30

Authoritative package: `evidence/d5-20261030T1940Z/`.
Current evaluation is **FAIL**, not certification-ready.

- `before.json`: pre-collection, 26 missing direct cases, seven incompatible
  historical workflows/baselines, and no measured mandatory criteria (34 errors).
- `direct-responses.json`: 26 real responses, including six runtime rejections.
- `workflows/ticket1-run.json` through `ticket5-run.json`: all five attempts,
  including the fully specified positive control; only ticket 1 completed (FAIL).
- `runs/`, `audit.jsonl`, `receipts/`: raw/input/prompt/request/parsed/validated
  artifacts where produced, actual failure records, and token usage for 39 calls.
- `baselines/`: byte-exact exports of original `4fcbf47` tickets 1-3, with source
  commit, blob ID, and SHA-256. Missing current provenance is not fabricated.
- `workflow-labels.json`: post-collection labels for the frozen ticket-1 reviewer
  input, independently grounded in source; direct-case gold remains unchanged.
- `after-labeled.json`, `diagnostics.json`: seven evidence errors, 26 failed
  scored steps, and a root cause for every failure; all 15 mandatory metric types
  now have direct observations.
- `source/`, `source-state.json`, `git-history.txt`: executed source snapshot and
  actual Git provenance. `verification/source/` contains final replay tooling/docs.
- `manifest.json`: original collection seal. `manifest-final.json`: final file
  inventory, including the unchanged original seal and subsequent verification.

Offline commands (no API calls, no `.git` needed for current baseline reads):

```text
node src/run-evals.js
node src/evidence-package.js evidence/d5-20261030T1940Z
```

Evaluator exits 1; integrity verifier exits 0. Strict direct-case score is 2/26,
not a semantic accuracy estimate. No prompt changed; two measured prompt-change
cycles per agent and repeat-run reliability remain unproven. Pooled writer 1.0
excludes two failed workflow writers and must not be called universal preservation.

## Historical Index - Not Current Certification Proof

The records below are retained for traceability. Their scores, success rates, and
iteration claims are superseded by the current evidence/qualifications above.

## Real Multi-Agent Workflow

Files:

- src/coordinator.js
- src/agent-runner.js
- src/agent-registry.js

---

## Requirement Interpreter

Files:

- agents/requirement-interpreter.md
- schemas/examiner.schema.json

Evidence:

- evidence/ticket1-run.json
- evidence/ticket2-run.json
- evidence/ticket3-run.json
- evidence/ticket4-run.json
- evidence/run1/ticket1-run.json
- evidence/run1/ticket2-run.json
- evidence/run1/ticket3-run.json
- evidence/run1/ticket4-run.json

---

## Adversarial Reviewer

Files:

- agents/adversarial-reviewer.md
- schemas/challenges.schema.json

Evidence:

- evidence/ticket1-run.json
- evidence/ticket2-run.json
- evidence/ticket3-run.json
- evidence/ticket4-run.json
- evidence/run1/ticket1-run.json
- evidence/run1/ticket2-run.json
- evidence/run1/ticket3-run.json
- evidence/run1/ticket4-run.json

---

## Final Review Writer

Files:

- agents/final-review-writer.md
- schemas/final-review.schema.json

Evidence:

- evidence/ticket1-run.json
- evidence/ticket2-run.json
- evidence/ticket3-run.json
- evidence/ticket4-run.json
- evidence/run1/ticket1-run.json
- evidence/run1/ticket2-run.json
- evidence/run1/ticket3-run.json
- evidence/run1/ticket4-run.json

---

## Re-Dispatch Governance

Files:

- src/coordinator.js
- src/prompt-builder.js
- src/artifact-writer.js

Evidence:

- runs/redispatch-evidence.md
- runs/HVAC-TICKET-1792016512336/*-pass1.json
- runs/HVAC-TICKET-1792016526650/*-pass1.json

Rule:

HIGH findings trigger re-dispatch with
`previousInterpretation` and `reviewerFindings`
fed back into the prompt.

---

## Human Escalation

Files:

- src/human-review.js
- src/substance-gate.js
- src/coordinator.js (explicit gate: APPROVE /
  CONTINUE / REJECT / no-decision / invalid /
  stale all return audited dispositions)

Evidence:

- runs/punchout-evidence.md
- runs/punchout-test-results.json
- runs/continue-decision-evidence.md
- runs/reject-decision-evidence.md
- audit/audit-log.jsonl
  (`coordinator-human-gate` entries)

Active test suite:

- src/test-punchout.js — 8 scenarios: silence,
  REJECT, CONTINUE, APPROVE, bypass attempts
  (unknown value, missing reason), stale-decision
  timeout, fresh decision honored. 8/8 pass.

---

## Per-Step Evaluations

Files:

- evals/requirement-interpreter-eval.md
- evals/adversarial-reviewer-eval.md
- evals/final-review-writer-eval.md
- evals/test-cases.json (expected outputs and
  pass/fail criteria per fixture)
- src/eval-scorer.js (scoring rubric)
- src/run-evals.js (eval runner)

Evidence:

- sub-agents-results.json (regenerated via
  `node src/run-evals.js`; contains per-fixture
  detail and baseline-vs-final iteration deltas)

Iteration logs (2+ cycles per step, with baseline
scores, hypotheses, changes, and measured deltas):

- evals/requirement-interpreter-eval.md
- evals/adversarial-reviewer-eval.md
- evals/final-review-writer-eval.md
- prompts/prompt-evolution.md

---

## Workflow Success Rate

Evidence:

- audit/workflow-success-rate.md

22/26 non-test executions completed end-to-end
(84.6%); latest 4 fixture evaluations 4/4 (100%);
per-step rates documented in the report.

---

## Schema Validation

Files:

- src/schema-validator.js
- schemas/

Evidence:

- interpreter validation
- reviewer validation
- writer validation

---

## Audit Trail

Files:

- audit/
- src/audit-logger.js

Evidence:

- audit-log.jsonl

Includes:

- token counts (`promptTokens`, `completionTokens`, `totalTokens`)
- per-step estimated `cost` and workflow `totalCost` (`auditSummary.totalCost`)
- `costMethod`
- timestamps
- correlation IDs
- coordinator human-gate decisions
  (`coordinator-human-gate`: PUNCH_OUT,
  PUNCH_OUT_INVALID_DECISION,
  PUNCH_OUT_DECISION_STALE, REJECTED_BY_HUMAN,
  HUMAN_APPROVED_CONTINUE)

---

## Version-Controlled Repository

Evidence:

- git-log.txt (exported commit history)
- GIT-HISTORY.md (milestones and progression)
