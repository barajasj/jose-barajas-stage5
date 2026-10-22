# Audit Trail

The workflow writes append-only audit records to:

audit/audit-log.jsonl

Each entry represents one completed agent execution.

## Recorded Fields (Per-Step Audit Log: `audit/audit-log.jsonl`)

- correlationId
- workflow
- agent
- model
- promptTokens
- completionTokens
- totalTokens
- cost
- costMethod
- status
- timestamp

## Workflow-Level Cost Summary (`totalCost` & `auditSummary`)

Each workflow execution returns a top-level `totalCost` and `auditSummary` object aggregating all executed steps (3 steps on standard runs, 5 steps when re-dispatched):

- model
- stepsExecuted
- reDispatched
- totalPromptTokens
- totalCompletionTokens
- totalTokens
- totalCost
- costMethod

## Cost Calculation Method

Fireworks API responses provide live token counts but do not provide cost information.

The cost field is calculated using the published configured model pricing:

- Input Tokens: $0.50 per 1,000,000 tokens
- Output Tokens: $2.50 per 1,000,000 tokens

Formula:

cost =
(promptTokens / 1,000,000 × 0.50)
+
(completionTokens / 1,000,000 × 2.50)

## Important Note

The cost value is an estimate.

Token counts are captured directly from Fireworks API responses.

Cost values are not returned by Fireworks and are therefore calculated locally using the documented pricing model.

## End-to-End Workflow Success Rate

Aggregated completion metrics across all workflow
executions are documented in:

audit/workflow-success-rate.md

Summary: 23 of 27 non-test workflow executions
completed end-to-end (85.2%); all 4 latest
evaluation runs completed (100%).

## Coordinator Human-Gate Audit Entries

The coordinator writes gate decisions under agent
`coordinator-human-gate` with statuses:

- `PUNCH_OUT` — no decision recorded
- `PUNCH_OUT_INVALID_DECISION` — unrecognized or
  unreasoned decision (bypass attempt, fail closed)
- `PUNCH_OUT_DECISION_STALE` — expired decision
- `REJECTED_BY_HUMAN` — explicit rejection
- `HUMAN_APPROVED_CONTINUE` — explicit
  APPROVE/CONTINUE honored with recorded reasoning