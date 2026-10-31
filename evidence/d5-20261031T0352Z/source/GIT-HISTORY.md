# Repository History

This file documents the meaningful version-control
history of the project for examination. The full
legacy exported commit log is `git-log.txt`. The current verified export is
`evidence/d5-20261030T1940Z/git-history.txt`; collection commit/dirty state and
executed source hashes are preserved in that package. The Deliverable 5 package
was committed in `58236a4`; measured F6 prompt-change evidence in `ecaabb5`.

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
| `daef6bb` | 2026-10-22 | Refinements: `totalTokens` tracking, `-pass1` artifact snapshots for re-dispatch comparison, `additionalProperties` schema tightening, output-path support in run-workflow |
| `27369cf` | 2026-10-22 | Human escalation gate made explicit: APPROVE/CONTINUE/REJECT/no-decision/invalid/stale all return audited dispositions; `src/test-punchout.js` added — 8 scenario tests (8/8 pass) |
| `60c5af2` | 2026-10-29 | Runtime governance contracts, deterministic disposition, bounded cycles, report fidelity, and regression tests |
| `bae61b6` | 2026-10-29 | Executable instruction coverage and targeted mutation controls |
| `374ed51` | 2026-10-29 | Complete reviewer finding example, required-field controls, and schema details |
| `8a09d44` | 2026-10-30 | Content-v2 scoring, direct cases, provenance validation, NA accounting, and failing evaluation exits |
| `58236a4` | 2026-10-30 | Measured evidence collection (Deliverable 5 package), refreshed workflow executions, certification outputs |
| `79e8db7` | 2026-10-30 | Scorer validity, reviewed equivalence matching, gold-label accuracy |
| `2f1a7a1` | 2026-10-30 | Ambiguity continuity fixes and workflow completion improvements (F3) |
| `ecaabb5` | 2026-10-30 | Evaluator validity, workflow reliability, and F6 measured prompt-change evidence (v0-v2, 84 calls) |

## Iterative Development Evidence

Historical narratives below are not proof of two comparable measured prompt
cycles per agent. Current live batch changed no prompts and remains nonpassing;
see the qualifications in `prompts/prompt-evolution.md`.

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
