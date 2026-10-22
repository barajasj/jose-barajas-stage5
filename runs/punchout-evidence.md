# Human Punch-Out Evidence

## Trigger

Human review required by substance assessment
(`overallAssessment.humanReviewRequired: true` or
TOY/PERIPHERAL thresholds in `src/substance-gate.js`).

## Coordinator Response

Workflow stopped before the `final-review-writer`
dispatch.

Status:

`PUNCH_OUT`

## Human Decision Required

APPROVE, CONTINUE, or REJECT recorded in
`human-decisions.jsonl` with `reviewer`, `reason`,
and `timestamp`.

## Result

Coordinator does not automatically approve workflow
results when escalation is required. Every gate branch
returns an explicit, audited disposition — there is no
implicit fall-through to approval.

---

## Active Punch-Out Test Suite

Executable test runner:

```
node src/test-punchout.js
```

Results artifact:

`runs/punchout-test-results.json`

Each scenario executes the real coordinator
(`src/coordinator.js`) against a controlled assessment
file and decisions file, then asserts the returned
disposition and whether `final-review-writer` was
dispatched.

### Scenario Matrix (8/8 passed)

| Scenario | Human Decision | Expected | Actual | Writer Dispatched |
|----------|----------------|----------|--------|-------------------|
| S1-silence-no-decision | (none recorded) | PUNCH_OUT | PUNCH_OUT | No |
| S2-explicit-reject | REJECT | REJECTED_BY_HUMAN | REJECTED_BY_HUMAN | No |
| S3-explicit-continue | CONTINUE | COMPLETED_AFTER_HUMAN_APPROVAL | COMPLETED_AFTER_HUMAN_APPROVAL | Yes |
| S4-explicit-approve | APPROVE | COMPLETED_AFTER_HUMAN_APPROVAL | COMPLETED_AFTER_HUMAN_APPROVAL | Yes |
| S5-bypass-unknown-value | "AUTO-APPROVE" (invalid) | PUNCH_OUT | PUNCH_OUT | No |
| S6-bypass-missing-reason | APPROVE, empty reason | PUNCH_OUT | PUNCH_OUT | No |
| S7-timeout-stale-decision | CONTINUE, expired | PUNCH_OUT | PUNCH_OUT | No |
| S8-fresh-decision-honored | CONTINUE, within window | COMPLETED_AFTER_HUMAN_APPROVAL | COMPLETED_AFTER_HUMAN_APPROVAL | Yes |

### Decision State Transitions

| Gate Input | Coordinator Action | Audit Status |
|------------|-------------------|--------------|
| No decision recorded | Halt before writer dispatch | `PUNCH_OUT` |
| Unrecognized/empty decision value | Halt (fail closed, no bypass) | `PUNCH_OUT_INVALID_DECISION` |
| APPROVE/CONTINUE missing reviewer or reason | Halt (fail closed) | `PUNCH_OUT_INVALID_DECISION` |
| Decision older than max age | Halt (fresh review required) | `PUNCH_OUT_DECISION_STALE` |
| REJECT | Halt with reviewer reason | `REJECTED_BY_HUMAN` |
| APPROVE / CONTINUE (valid, fresh) | Log reasoning, dispatch writer | `HUMAN_APPROVED_CONTINUE` |

### Bypass Testing Evidence

- **S5** proves an unrecognized decision value cannot
  bypass the gate: `AUTO-APPROVE` yields
  `PUNCH_OUT` with audit status
  `PUNCH_OUT_INVALID_DECISION`.
- **S6** proves an unreasoned approval cannot bypass
  the gate: `APPROVE` with an empty `reason` yields
  `PUNCH_OUT`.
- **S1** proves silence cannot bypass the gate.
- **S7** proves an expired decision cannot bypass the
  gate: a stale timestamp is treated as a timeout and
  requires fresh review.

Audit entries for every scenario are appended to
`audit/audit-log.jsonl` under agent
`coordinator-human-gate`, providing a per-decision
reasoning trail.
