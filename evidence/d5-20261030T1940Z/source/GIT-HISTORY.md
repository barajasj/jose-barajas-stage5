# Repository History

This file documents the meaningful version-control
history of the project for examination. The full
exported commit log (with per-file stats) is in
`git-log.txt` at the repository root.

Regenerate after future commits:

```
git log --stat --format="commit %H%nAuthor: %an <%ae>%nDate: %ad%n%n    %s%n    %b" > git-log.txt
```

## Commit Progression

| Commit | Date | Milestone |
|--------|------|-----------|
| `f55c807` | 2026-10-12 | Initial commit: coordinator design docs, agent prompts, schemas, fixtures 1-3, eval criteria, substance assessment, workflow definition |
| `c41558a` | 2026-10-13 | Workflow runtime: coordinator.js, agent-runner, registry, schema validation, artifact writer, audit logger, substance gate, human-review loader; first runs + punch-out/re-dispatch evidence docs |
| `02a9758` | 2026-10-13 | Model integration groundwork: prompt design/evolution docs, model client, env config; agent prompts converted to templates |
| `1e2237a` | 2026-10-14 | Live Fireworks inference (`gpt-oss-120b`): fireworks-client, prompt-builder, strict JSON output requirements added to agent prompts after a `JSON_PARSE_FAILURE` run; connectivity test evidence |
| `4fcbf47` | 2026-10-14 | Three-agent pipeline live: first real end-to-end runs persisted under `evidence/run1/` and `runs/`; reviewer/writer prompts hardened with exact JSON structures |
| `40e7ab0` | 2026-10-14 | Completion pass: ticket 4 fixture, cost estimation + `totalCost`/`auditSummary` aggregation, deterministic report heading, expanded evidence set |
| `daef6bb` | 2026-10-14 | Refinements: `totalTokens` tracking, `-pass1` artifact snapshots for re-dispatch comparison, `additionalProperties` schema tightening, output-path support in run-workflow |
| `27369cf` | 2026-10-22 | Human escalation gate made explicit: APPROVE/CONTINUE/REJECT/no-decision/invalid/stale all return audited dispositions; `src/test-punchout.js` added — 8 scenario tests (8/8 pass) |

## Iterative Development Evidence

- **Prompt iterations**: strict JSON output
  requirements added after `JSON_PARSE_FAILURE`
  (HVAC-TICKET-1791999987142); ambiguity and
  terminology instructions added in
  `agents/requirement-interpreter.md` (see
  `prompts/prompt-evolution.md`).
- **Governance iterations**: re-dispatch loop with
  `previousInterpretation`/`reviewerFindings`
  feedback (`src/prompt-builder.js`), followed by
  the explicit human-gate refactor in `27369cf`.
- **Evidence growth**: run artifacts preserved per
  `correlationId` under `runs/`, evaluation runs
  under `evidence/`, audit entries appended to
  `audit/audit-log.jsonl` across every run.
