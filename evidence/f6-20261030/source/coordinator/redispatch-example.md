# Re-Dispatch Example

## Initial Ticket

Implement Coil Height validation.

---

## Interpreter Output

Requirement:
Coil Height must be between 1.25" and 100".

Confidence:
HIGH

---

## Adversarial Review

Finding Severity:
HIGH

Finding:

The interpretation does not mention the business note requiring values to be rounded to the nearest tube spacing multiple.

---

## Coordinator Action

The coordinator does not resolve the issue.

The coordinator re-dispatches the Requirement Interpreter with:

- Original Ticket
- Original Interpretation
- Reviewer Challenge

---

## Updated Interpretation

Requirement:
Coil Height must be between 1.25" and 100".

Validation Rule:
Input must be rounded to nearest allowed tube spacing increment.

Confidence:
MEDIUM

---

## Re-Review

Finding resolved.

---

## Final Disposition

PASS