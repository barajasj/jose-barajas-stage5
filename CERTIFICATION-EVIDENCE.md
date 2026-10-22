# Stage 5 Evidence Index

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

Evidence:

- runs/redispatch-evidence.md

Rule:

HIGH findings trigger re-dispatch.

---

## Human Escalation

Files:

- src/human-review.js
- src/substance-gate.js

Evidence:

- runs/punchout-evidence.md
- runs/continue-decision-evidence.md
- runs/reject-decision-evidence.md

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