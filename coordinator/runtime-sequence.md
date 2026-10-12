# Runtime Sequence

## Workflow Start

Input:
- HVAC Ticket

Generate:
- Correlation ID

Record:
- Audit Entry

---

## Coordinator Dispatch 1

Tool:

launch_requirement_interpreter

Input:
- HVAC Ticket

Expected Output:
- examiner.schema.json compliant document

---

## Guardrail 1

Validate examiner output.

If validation fails:

- Audit failure
- Stop workflow

---

## Coordinator Dispatch 2

Tool:

launch_adversarial_reviewer

Input:
- HVAC Ticket
- Interpreter Output

Expected Output:
- challenges.schema.json compliant document

---

## Guardrail 2

Validate reviewer output.

If validation fails:

- Audit failure
- Stop workflow

---

## Governance Decision

If reviewer finds HIGH severity issues:

- Re-dispatch Interpreter
- Re-run Reviewer

Else:

- Continue

---

## Coordinator Dispatch 3

Tool:

launch_final_review_writer

Input:
- Interpreter Output
- Reviewer Output
- Disposition

Expected Output:
- final-review.schema.json compliant document

---

## Guardrail 3

Validate final review output.

If validation fails:

- Audit failure
- Stop workflow

---

## Audit Persistence

Store:

- Correlation ID
- Agent
- Model
- Tokens
- Cost
- Status

---

## Workflow Complete

Return:

- Final Report
- Final Disposition