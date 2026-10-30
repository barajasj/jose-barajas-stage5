# Coordinator Decision Flow

## Objective

Govern agent execution without performing business work.

The coordinator never interprets HVAC requirements, performs reviews, or writes reports.

The coordinator only routes work and reasons over agent outputs.

---

## Step 1

Dispatch HVAC Requirement Interpreter.

Input:
- Ticket

Expected Output:
- Valid examiner schema

---

## Step 2

Validate Interpreter Output.

If schema validation fails:

- Record audit event
- Return structured error
- Do not continue

---

## Step 3

Dispatch Adversarial Reviewer.

Input:
- Original Ticket
- Interpreter Output

Expected Output:
- Valid challenges schema

---

## Step 4

Validate Adversarial Output.

If schema validation fails:

- Record audit event
- Return structured error
- Do not continue

---

## Step 5

Evaluate Review Findings.

If no HIGH severity findings exist:

- Proceed to Final Review Writer.

If HIGH severity findings exist:

- Re-dispatch Requirement Interpreter.
- Include reviewer findings.
- Request re-analysis.

---

## Step 6

Re-Review.

Dispatch Adversarial Reviewer again.

Input:
- Updated interpreter output

Expected Output:
- Updated findings

---

## Step 7

Human Escalation Gate.

If `requiresHumanReview()` is true, the coordinator
explicitly evaluates the latest recorded human
decision before any further dispatch:

- No decision recorded:
  Status = PUNCH_OUT (halt, audited)
- Decision unrecognized or missing reviewer/reason:
  Status = PUNCH_OUT (fail closed, audited)
- Decision older than the maximum allowed age:
  Status = PUNCH_OUT (timeout, audited)
- Decision = REJECT:
  Status = REJECTED_BY_HUMAN (halt, audited)
- Decision = APPROVE or CONTINUE:
  governance reasoning is logged to the audit trail
  as HUMAN_APPROVED_CONTINUE and the workflow
  proceeds to the Final Review Writer.

There is no implicit fall-through: every gate branch
returns an explicit disposition or records explicit
reasoning. Test coverage: `src/test-punchout.js`
(8 scenarios).

## Step 8

Final Disposition.

If critical findings remain:

Disposition = FAIL

Otherwise:

Disposition = PASS

---

## Step 9

Dispatch Final Review Writer.

Input:
- Interpreter Output
- Adversarial Review Output
- Coordinator Disposition

Output:
- Final Report

---

## Step 10

Persist Audit Trail.

Persist:

- Correlation ID
- Agent
- Model
- Tokens
- Cost
- Status
- Timestamp

---

## Step 11

Return Final Result.