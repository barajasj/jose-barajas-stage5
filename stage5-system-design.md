# Stage 5 HVAC Ticket Governance System

## Goal

Analyze HVAC software requirements and produce a reviewed implementation assessment using a delegation-based multi-agent architecture.

---

# Coordinator

Purpose:
- Dispatch sub-agents
- Review results
- Decide next actions
- Never perform work directly

Allowed Tools:
- launch_requirement_interpreter
- launch_adversarial_reviewer
- launch_final_review_writer

Forbidden Tools:
- read_file
- write_file
- bash
- http_get
- git
- database access

---

# Sub-Agent 1

Name:
HVAC Requirement Interpreter

Purpose:
Analyze HVAC tickets and produce structured requirement interpretation.

Inputs:
- Ticket content

Outputs:
- Requirement Summary
- HVAC Terminology
- Developer Considerations
- Ambiguities
- Questions
- Confidence Assessment

Input transport:
- Ticket injected into a stateless request; no runtime tools.

---

# Sub-Agent 2

Name:
Adversarial Reviewer

Purpose:
Challenge and verify the Requirement Interpreter output.

Inputs:
- Original ticket
- Requirement Interpreter output

Outputs:
- Findings
- Unsupported Assumptions
- Missing Requirements
- Ambiguities Missed
- Severity Assessment

Input transport:
- Ticket and interpreter output injected into a stateless request; no runtime tools.

Isolation:
- Separate context
- Independent execution

---

# Sub-Agent 3

Name:
Final Review Writer

Purpose:
Generate the final report.

Inputs:
- Requirement Interpreter output
- Adversarial Review output
- Coordinator disposition

Outputs:
- Final Review Report

Input transport:
- Validated upstream artifacts and bounded report injected; no runtime tools.

Restriction:
- Must not create new findings

---

# Workflow

1. Coordinator launches Requirement Interpreter

2. Coordinator receives interpretation

3. Coordinator launches Adversarial Reviewer

4. Coordinator evaluates review

5. If actionable HIGH interpretation defects exist and cycles remain:
   - Re-dispatch Requirement Interpreter with source-preserving feedback
   - Re-run Adversarial Review under identical contracts
   - Never erase missing ticket facts or silently drop prior concerns

6. After bounded reviews and any required human gate:
   - Derive FAIL for any finding or open ambiguity, otherwise PASS
   - Launch Final Review Writer for either derived disposition
   - Validate exact supplied content before persistence or SUCCESS

7. Produce final report

---

# Stage 5 Compliance

Coordinator is dispatch-only.

All sub-agents are workflow-scoped.

Adversarial review executes in isolated context.

Final Review Writer performs synthesis only.

All outputs are schema validated before coordinator consumption.

Audit trail is persisted to disk.

Human punch-outs are honored.

Local instruction coverage is measured separately from model performance.
Current live evaluation remains FAIL; see `evidence/d5-20261030T1940Z/diagnostics.json`.
No certification or measured prompt-evolution guarantee is made.