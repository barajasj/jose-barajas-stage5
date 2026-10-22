# Model Integration Plan

## Current State

Live execution via Fireworks AI (`src/models/fireworks-client.js`) using `accounts/fireworks/models/gpt-oss-120b` (with optional `RUNTIME_MODE=mock` fallback in `src/mock-agent-responses.js`).

## Architecture Flow

Agent Runner
  ↓
Prompt Loader & Builder
  ↓
Configured Model (`accounts/fireworks/models/gpt-oss-120b`)
  ↓
Schema Validation (`ajv`)
  ↓
Audit Trail & Cost Estimation (`audit/audit-log.jsonl`)

## Objectives

- Replace mock responses
- Preserve schema validation
- Preserve audit logging
- Preserve artifact persistence
- Preserve coordinator dispatch-only architecture

## Success Criteria

Each sub-agent produces real model output.

Coordinator remains unchanged.