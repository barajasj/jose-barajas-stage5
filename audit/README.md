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

## Cost Method

Fireworks does not return cost information in API responses.

Estimated cost is calculated using:

Input:
$0.50 / 1M tokens

Output:
$2.50 / 1M tokens

Formula:

(promptTokens / 1,000,000 * 0.50)
+
(completionTokens / 1,000,000 * 2.50)

This value is an estimate only and should not be considered a billing record.