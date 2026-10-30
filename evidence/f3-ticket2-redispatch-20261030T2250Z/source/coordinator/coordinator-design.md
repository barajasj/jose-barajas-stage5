# Coordinator Design

## Purpose

The coordinator governs the multi-agent workflow.

The coordinator does not perform business work.

The coordinator only:

- Dispatches sub-agents
- Reviews agent results
- Decides next actions
- Determines whether additional review is required
- Initiates final report generation

---

# Allowed Tools

## launch_requirement_interpreter

Launches the HVAC Requirement Interpreter workflow.

Input:
- Ticket

Output:
- Structured examination result

---

## launch_adversarial_reviewer

Launches the Adversarial Reviewer workflow.

Input:
- Ticket
- Interpreter output

Output:
- Review findings

---

## launch_final_review_writer

Launches the Final Review Writer workflow.

Input:
- Interpreter output
- Review output
- Coordinator disposition

Output:
- Final report

---

# Forbidden Tools

The coordinator may NOT possess:

- read_file
- write_file
- http_get
- http_post
- bash
- shell
- git
- database access

The coordinator only dispatches agents.

---

# Decision Logic

Step 1:
Launch Requirement Interpreter.

Step 2:
Receive validated interpreter output.

Step 3:
Launch Adversarial Reviewer.

Step 4:
Receive validated review output.

Step 5:
Assess review findings.

If HIGH severity findings exist:

- Re-dispatch Requirement Interpreter
- Include reviewer findings
- Re-run Adversarial Review

Otherwise:

- Launch Final Review Writer

Step 6:
Receive final report.

Step 7:
Persist audit records.

Step 8:
Return final disposition.

---

# Coordinator Responsibilities

The coordinator is responsible for:

- Delegation
- Governance
- Routing
- Audit correlation
- Human escalation routing

The coordinator is NOT responsible for:

- Requirement analysis
- HVAC interpretation
- Technical review
- Report writing

Those responsibilities belong to sub-agents.