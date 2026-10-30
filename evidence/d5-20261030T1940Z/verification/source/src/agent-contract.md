```
The agent runner should do:
Load Agent Prompt
Call Model
Validate Output
Write Audit Record
Return Structured Result

This keeps the coordinator "dispatch-only".
```

---

# Agent Runner Contract

## Coordinator Responsibilities

The coordinator may:

- Choose which agent to run
- Evaluate agent results
- Decide next action

The coordinator may NOT:

- Construct prompts
- Call models
- Read prompt files
- Parse ticket files
- Validate schemas

---

## Agent Runner Responsibilities

The agent runner may:

- Load agent prompts
- Send requests to models
- Capture token usage
- Validate schemas
- Record audit entries
- Return structured results

---

## Execution Flow

Coordinator
    ↓
runAgent()
    ↓
Load Prompt
    ↓
Call Model
    ↓
Validate Output
    ↓
Audit
    ↓
Return Result