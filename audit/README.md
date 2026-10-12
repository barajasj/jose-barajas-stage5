# Audit Trail

This audit trail records every coordinator and sub-agent execution.

Each record contains:

- Correlation ID
- Agent Name
- Model
- Prompt Tokens
- Completion Tokens
- Total Cost
- Timestamp
- Execution Status

Purpose:

- End-to-end traceability
- Stage 5 compliance
- Post-hoc auditing
- Cost tracking
- Workflow debugging

All audit data is persisted to disk.

Correlation IDs connect every execution within a single examination workflow.