# Stage 5 Execution Summary

## Current Measured Status - 2026-10-30

**Blocked; current evaluator exits 1.** Authoritative evidence:
`evidence/d5-20261030T1940Z/`.

- 39 authorized model invocations, one attempt per direct case/workflow, no reruns.
- 26/26 direct responses saved; 20/26 satisfy runtime contracts; 2/26 satisfy
  strict fixed-wording scoring. Wording mismatch is not proof of semantic error.
- All 15 mandatory metric types have direct observations, replacing the earlier
  no-measurement failure.
- Workflows: ticket 1 COMPLETED/FAIL; ticket 2 SCHEMA_FAILURE; ticket 3 invalid
  source quote; ticket 4 and positive control failed bounded report fidelity.
- Current evaluation: seven evidence errors, 26 failed scored steps. Three
  historical baselines remain unscorable; no statuses/provenance were invented.
- Coverage unchanged: 16/16, 19/19, 12/12; 61 positive and 152 negative controls.

Full before/after JSON and each remaining cause are in `before.json`,
`after-labeled.json`, and `diagnostics.json`. Writer aggregate 1.0 covers only
two direct cases and one completed workflow; two failed workflow writers remain
failures. Positive control did not demonstrate clean PASS. No prompt-change
cycles or repeated-run reliability were established by this batch.

## Historical Summary - Not Revalidated Current Results

The rates, scores, and completion claims below belong to the legacy submission.
They are retained as historical records, not evidence that current gates pass.

## Real AI Execution

Provider:
Fireworks AI

Model:
accounts/fireworks/models/gpt-oss-120b

---

## End-to-End Runs

Completed:

- Ticket 1
- Ticket 2
- Ticket 3
- Ticket 4

All runs executed successfully using live model responses.

## Workflow Success Rate

27 non-test workflow executions in
`audit/audit-log.jsonl`:

- 23 completed end-to-end = 85.2% completion rate
- 4 latest fixture evaluations: 4/4 = 100%

Details:
`audit/workflow-success-rate.md`

---

## Governance

Implemented and explicitly handled:

- Re-dispatch on HIGH findings
- Human punch-out (no decision recorded)
- Human CONTINUE (explicit, audited)
- Human APPROVE (explicit, audited)
- Human REJECT (explicit, audited)
- Invalid/unreasoned decision -> fail closed
- Stale/timed-out decision -> fail closed

Human gate audit entries:
`coordinator-human-gate` in `audit/audit-log.jsonl`

Active gate test suite:
`node src/test-punchout.js`
(8/8 scenarios pass — see
`runs/punchout-test-results.json` and
`runs/punchout-evidence.md`)

---

## Guardrails

Implemented:

- JSON parsing
- Schema validation
- Parse failure handling
- Schema failure handling
- Human decision validation + staleness check

---

## Auditability

Implemented:

- Correlation IDs
- Audit trail
- Token tracking
- Cost estimation
- Artifact persistence
- Coordinator gate reasoning logs

---

## Per-Step Evaluations

Automated scorer:
`node src/run-evals.js`

Test case definitions:
`evals/test-cases.json`

Measured results (baseline -> final, pooled across
fixtures 1-4):

- requirement-interpreter: extraction 0.900->0.933,
  terminology 0.864->1.000, ambiguity 0.500->1.000
- adversarial-reviewer: unsupported 1.000->1.000,
  missing-req 0.250->0.727 (below 0.85 threshold;
  documented next iteration), quality 1.000->1.000
- final-review-writer: preservation 0.800->1.000,
  completeness 1.000->1.000, quality 0.667->1.000

Iteration logs:
`evals/requirement-interpreter-eval.md`
`evals/adversarial-reviewer-eval.md`
`evals/final-review-writer-eval.md`
