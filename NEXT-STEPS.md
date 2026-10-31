# Stage 5 Status

## Current Evidence

`evidence/d5-20261030T1940Z/` replaces missing direct observations with one complete
authorized batch. Default evaluation still FAILs: seven evidence errors and 26
failed scored steps. All 15 mandatory metric types have direct observations.

## Latest Batch - 2026-10-31

`evidence/d5-20261031T0352Z/` is one more authorized live batch (41 of 51 calls, one
attempt per case, no repair or retry, same prompts as the 10-30 batch). Evaluation still
FAILs: five evidence errors and 24 failed scored steps (8 interpreter, 16 reviewer).

| Measure | 10-30 batch | 10-31 batch |
|---|---|---|
| Direct runtime successes | 20/26 | 23/26 |
| Direct scorer passes | 2/26 | 2/26 |
| Workflows completed | 1/5 | 5/5 (all FAIL disposition, as open ambiguities block PASS) |
| Evidence errors | 7 | 5 |
| Failed scored steps | 26 | 24 |

Open from this batch: direct cases `hvac`, `retained`, `bad-resolution` fail runtime
governance; all five evidence errors are missing frozen reviewer labels for the new workflow
reviewer inputs (needs a separately reviewed label change, not inference from output);
interpreter strict scores remain low (requirement extraction 0.15 vs 0.9, ambiguity 0.18 vs 0.8).
This is a repeat sample of unchanged prompts, not a measured prompt-change cycle.

## Required Before Certification

- Address reviewer missing `ambiguityRefs`, invalid source quotations/pointers,
  and interpreter re-dispatch ambiguity deletion without sourced resolutions.
- Address writer source-string escaping and exact content preservation. Ticket 4
  and the positive control failed; do not relax contracts to relabel them successes.
- Resolve strict gold-wording versus valid paraphrase grading through a separately
  reviewed scorer/label change; do not infer semantic accuracy from exact-match scores.
- Preserve original baselines as unscorable history; collect a genuine compatible
  prospective baseline before claiming paired improvement.
- Demonstrate clean positive-control PASS without invented out-of-scope questions.
- Conduct separately authorized prompt changes, at least two measured change
  cycles per agent, plus repeat runs. Preserve every attempt; no cherry-picking.

Per-case causes and raw artifact paths: `diagnostics.json` in the package.
API use for further measurement was authorized by the owner on 2026-10-30 for
F3/F6 collection (see `evidence/f3-*` and `evidence/f6-20261030/`). Any new live run
needs fresh owner approval and must preserve every attempt, including failures.
Open: F6 latest-candidate strict acceptance is FAIL; reviewer v2 regressed; interpreter
strict scores remain 0/8.

## Implemented Runtime Components

- Coordinator (`src/coordinator.js`)
- Agent Runner (`src/agent-runner.js`)
- Agent Registry (`src/agent-registry.js`)
- Schema Validation (`src/schema-validator.js`)
- Audit Trail (`src/audit-logger.js`, `audit/audit-log.jsonl`)
- Per-Step Cost & Workflow Total Cost Tracking (`src/cost-estimator.js`)
- Artifact Persistence (`src/artifact-writer.js`)
- Re-Dispatch Governance (`HIGH` findings trigger re-dispatch with reviewer findings)
- Human Review Gate (`src/substance-gate.js`, `src/human-review.js`)
- Fireworks Model Integration (`src/models/fireworks-client.js` with `accounts/fireworks/models/gpt-oss-120b`)
- Current runtime evaluations (four HVAC fixtures plus positive control), including failures

## Optional Future Enhancements

- Expand HVAC fixture suite with additional edge-case tickets
- Assertion-based test/eval runners are implemented; continue adding targeted
  regressions when defects are corrected. Historical 0.727 is not a current score.