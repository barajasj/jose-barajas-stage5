# Stage 5 Certification Project

# HVAC Ticket Governance System

## Overview

This project demonstrates a Stage 5 delegation-based AI system for HVAC software requirement analysis.

The system uses a dispatch-only coordinator that governs multiple specialized sub-agents.

The coordinator performs no business work itself.

Instead, it:

- Dispatches agents
- Reviews validated outputs
- Makes routing decisions
- Initiates re-review workflows
- Produces final dispositions

Coordinator Rule:

HIGH findings → re-dispatch

MEDIUM findings → continue

LOW findings → continue
---

# Setup

`node_modules/` is not included in this submission.

Restore dependencies before running any scripts:

```
npm ci
```

(or `npm install` to resolve fresh — requires Node.js 18+)

Environment:

Copy `env.example` to `.env` and set `AI_API_KEY`
for live model execution, or set `RUNTIME_MODE=mock`
for offline/mock testing.

---

# Model Execution

Runtime inference executes live against `accounts/fireworks/models/gpt-oss-120b` via the Fireworks API client (`src/models/fireworks-client.js`), with an optional mock mode (`RUNTIME_MODE=mock`) for offline testing.

---
# Business Problem

HVAC software requirements often contain:

- Domain-specific terminology
- Ambiguous acceptance criteria
- Hidden business rules
- Validation requirements

Misinterpreting these requirements can result in implementation defects.

This system provides:

1. Requirement interpretation
2. Independent adversarial review
3. Final synthesized reporting

through delegated workflows.

---

# Stage 5 Architecture

## Coordinator

Purpose:

Govern the workflow.

Allowed responsibilities:

- Dispatch agents
- Review outputs
- Route work
- Initiate re-review
- Record audit information

Forbidden responsibilities:

- HVAC analysis
- Requirement interpretation
- Review authoring
- Report writing

Allowed tools:

- launch_requirement_interpreter
- launch_adversarial_reviewer
- launch_final_review_writer

Additional details:

See:

coordinator/coordinator-design.md

---

## Sub-Agent 1

HVAC Requirement Interpreter

Purpose:

Convert HVAC tickets into structured implementation guidance.

Evidence:

agents/requirement-interpreter.md

Evaluation:

evals/requirement-interpreter-eval.md

---

## Sub-Agent 2

Adversarial Reviewer

Purpose:

Challenge assumptions and identify gaps.

Evidence:

agents/adversarial-reviewer.md

Evaluation:

evals/adversarial-reviewer-eval.md

---

## Sub-Agent 3

Final Review Writer

Purpose:

Generate final stakeholder-facing review reports.

Evidence:

agents/final-review-writer.md

Evaluation:

evals/final-review-writer-eval.md

---

# Workflow

1. Coordinator dispatches Requirement Interpreter.

2. Interpreter output is schema validated.

3. Coordinator dispatches Adversarial Reviewer.

4. Reviewer output is schema validated.

5. Coordinator evaluates findings.

6. Critical findings trigger re-dispatch and re-review.

7. Final Review Writer generates report.

8. Audit records are persisted.

9. Final disposition is produced.

Workflow definition:

workflow-definition.yaml

Decision flow:

coordinator/coordinator-decision-flow.md

---

# Guardrails

All sub-agent outputs are validated before reaching the coordinator.

Schemas:

schemas/examiner.schema.json

schemas/challenges.schema.json

schemas/final-review.schema.json

Validation failures halt execution and return structured errors.

---

# Adversarial Review Isolation

Each review workflow executes in an isolated context.

Isolation evidence:

sub-agents.config.yaml

Field:

isolated_context: true

The reviewer does not share conversation history with the producing agent.

---

# Audit Trail

The system records:

- Correlation IDs
- Agent executions
- Model usage
- Token consumption
- Cost data
- Execution status
- Timestamps

Evidence:

audit/

End-to-end workflow success rate:

audit/workflow-success-rate.md

(23/27 non-test executions completed end-to-end =
85.2%; latest 4 evaluation runs = 100%)

---

# Substance Assessment

Workflow classifications:

| Workflow | Classification |
|----------|----------|
| HVAC Requirement Interpreter | CORE |
| Adversarial Reviewer | CORE |
| Final Review Writer | PERIPHERAL |

Evidence:

substance-assessment.md

substance-assessment.json

---

# Human Escalation Support

The system supports human review decisions with
explicit, audited gate handling — every branch
returns an explicit disposition (no implicit
auto-approval):

- No decision -> PUNCH_OUT
- Invalid/unreasoned decision -> PUNCH_OUT (fail closed)
- Stale/timed-out decision -> PUNCH_OUT
- REJECT -> REJECTED_BY_HUMAN
- APPROVE / CONTINUE -> audited
  HUMAN_APPROVED_CONTINUE, then writer dispatch

Evidence:

human-decisions.jsonl

runs/punchout-evidence.md

runs/punchout-test-results.json

Gate test suite:

node src/test-punchout.js (8/8 scenarios pass)

---

# Stage 3 Evaluation Guarantees

Each sub-agent includes:

- Defined prompt
- Named evaluation criteria
- Test case definitions (evals/test-cases.json)
- Documented scoring rubric and methodology
- Measured results with iteration history
  (baseline -> final deltas)

Evidence:

evals/

sub-agents-results.json

Eval runner:

```text
npm test
npm run eval:controls
node src/run-evals.js
```

`eval:controls` checks authored controls and instruction coverage, not live-model accuracy.
The default evaluator validates persisted real-model evidence and exits nonzero for missing
direct responses, incompatible historical artifacts, hard-gate violations, or missed thresholds.
It prints JSON without overwriting historical `sub-agents-results.json`.
Use `--responses FILE` for fixed direct-step observations and `--definitions FILE` for
compatible workflow/baseline paths. Full contracts and `content-v2` scoring rules:
`evals/requirement-interpreter-eval.md`, "Current scorer - Deliverable 4".
Fresh model runs, evidence repair, and prompt-evolution measurements remain deferred.

---

## Sample Artifacts

- examples/examiner-output.json
- examples/reviewer-output.json
- examples/final-review-output.md

---

# Key Stage 5 Demonstration

This project demonstrates:

- Dispatch-only coordinator
- Least-privilege tool access
- Multi-agent orchestration
- Adversarial review
- Context isolation
- Deterministic guardrails
- Audit persistence
- Human escalation support
- Re-dispatch governance
- Stage 3 evaluation continuity

---

## Honest Open Items

### Reviewer Findings Remain

Current tickets still produce reviewer findings.

This is expected.

The purpose of the Adversarial Reviewer is to identify assumptions, ambiguities, and missing requirements before implementation.

### Cost Tracking

Token counts (`promptTokens`, `completionTokens`, `totalTokens`) are captured directly from Fireworks API responses.

Per-step `cost` and workflow-level `totalCost` (`auditSummary.totalCost`) are calculated using published `gpt-oss-120b` pricing (`src/cost-estimator.js`) because Fireworks API responses do not include billing cost fields.

### Evaluation Runs

Four end-to-end HVAC tickets (`fixtures/hvac-ticket-1.md` through `fixtures/hvac-ticket-4.md`) have been executed with full evidence persisted under `evidence/` and `runs/`.

### Repository History

Full commit history is exported for examination in
`GIT-HISTORY.md` and `git-log.txt` at the repository
root.
