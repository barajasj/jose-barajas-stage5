# Model Layer Contract

## Purpose

Provide a single abstraction for model execution.

The coordinator must never call a model directly.

The model layer is responsible for:

- Sending prompts
- Receiving responses
- Capturing token usage
- Capturing costs
- Returning structured results

---

## Allowed Consumers

- agent-runner.js

---

## Forbidden Consumers

- coordinator.js

The coordinator may dispatch agents only.