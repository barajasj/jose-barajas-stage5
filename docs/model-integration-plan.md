# Model Integration Plan

## Current State

Mock execution

Source:
mock-agent-responses.js

## Target State

Agent Runner
  ↓
Prompt Loader
  ↓
Configuraed Model (e.g. gpt-oss-120b)
  ↓
Schema Validation
  ↓
Audit Trail

## Objectives

- Replace mock responses
- Preserve schema validation
- Preserve audit logging
- Preserve artifact persistence
- Preserve coordinator dispatch-only architecture

## Success Criteria

Each sub-agent produces real model output.

Coordinator remains unchanged.