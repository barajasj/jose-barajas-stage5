# Correlation ID Strategy

Every examination receives a unique correlation ID.

Example:

EXAM-20261012-001

The same correlation ID is attached to:

- Coordinator execution
- Requirement Interpreter execution
- Adversarial Reviewer execution
- Final Review Writer execution

Benefits:

- End-to-end tracing
- Cost aggregation
- Auditability
- Debugging support

The audit trail survives process termination because records are persisted to disk.