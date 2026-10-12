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

Final Disposition.

If critical findings remain:

Disposition = FAIL

Otherwise:

Disposition = PASS

---

## Step 8

Dispatch Final Review Writer.

Input:
- Interpreter Output
- Adversarial Review Output
- Coordinator Disposition

Output:
- Final Report

---

## Step 9

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

## Step 10

Return Final Result.