# F3 Runtime Remediation

## Outcome

F3 reviewer/writer contract changes are implemented and measured. The latest
batch validates all 23 reviewer calls and all 6 writer calls, including the
original rejected inputs. Workflow completion is not universal: ticket 2 stops
at an unchanged interpreter-transition guard on its second interpretation.
No F6 work was performed.

Completion means a validated report, including a governed FAIL disposition.
Every completed workflow in both new batches has disposition FAIL. This is not
semantic-accuracy evidence, certification readiness, or a clean positive-control
PASS; the separate F4 positive-control limitation remains.

## Before / After

The before observations are the preserved `evidence/d5-20261030T1940Z/` batch,
not incompatible archival exports. Both new batches are retained in full.

| Measure | Before | Batch A | Latest Batch B | All New Attempts |
| --- | --- | --- | --- | --- |
| Workflow completion | 1/5 (20%) | 3/5 (60%) | 4/5 (80%) | 7/10 (70%) |
| Workflow aborts | 4/5 (80%) | 2/5 (40%) | 1/5 (20%) | 3/10 (30%) |
| Fixed direct reviewer acceptance | 11/16 (68.75%) | 11/16 (68.75%) | 16/16 (100%) | 27/32 (84.375%) |
| Frozen failed workflow reviewer acceptance | 0/2 (0%) | 2/2 (100%) | 2/2 (100%) | 4/4 (100%) |
| Frozen failed workflow writer fidelity | 0/2 (0%) | 2/2 (100%) | 2/2 (100%) | 4/4 (100%) |
| Workflow reviewer acceptance | 3/5 (60%) | 6/7 (85.714%) | 5/5 (100%) | 11/12 (91.667%) |
| Workflow writer fidelity | 1/3 (33.333%) | 3/4 (75%) | 4/4 (100%) | 7/8 (87.5%) |

Writer denominators include rejected responses, not just completed workflows.
Across both new batches, all writer calls total 12 attempts: 11 exact successes,
1 rejection. Latest-batch writer calls total 6 attempts: 6 exact successes,
0 rejections. Ticket 2 never reaches the latest writer; that is not a success.

Fixed direct cases pair the same input bytes, model, temperature, schema, and
runtime validation contracts. All 40 direct/frozen attempt identities match.
The 16 fixed reviewer case IDs cover 14 distinct inputs; duplicate-input case
IDs remain separate retained observations, not independent coverage claims.
Workflow inputs are the same ticket bytes, but upstream model artifacts are
fresh, so workflow deltas are descriptive, not isolated causal prompt effects.

## Workflow Attempts

| Ticket | Before | Batch A | Latest Batch B |
| --- | --- | --- | --- |
| 1 | Completed / FAIL | Reviewer citation rejected | Completed / FAIL |
| 2 | Reviewer missing ambiguityRefs | Completed / FAIL | Interpreter transition rejected |
| 3 | Reviewer citation rejected | Completed / FAIL | Completed / FAIL |
| 4 | Writer escaping rejected | Writer escaping rejected | Completed / FAIL |
| Positive control | Writer wording rejected | Completed / FAIL | Completed / FAIL |

Batch A: `evidence/f3-20261030T2218Z/`, 38 Fireworks calls.
Batch B: `evidence/f3-20261030T2225Z/`, 35 Fireworks calls.
Total: 73 calls, 166042 prompt tokens, 137030 completion tokens, 303072 total.
One attempt per declared case/workflow in each batch; no unsuccessful attempt
was overwritten or excluded. Provider SDK transport retries are not separately
attested by these application-level receipts.

Batch A's remaining failures were six reviewer rejections (joined ticket lines,
wrong array index, incomplete ambiguity coverage, or an invalid ambiguity
pointer) and one writer rejection (lost literal backslashes).
Batch B has no reviewer/writer rejection. Its one abort is ticket 2,
cycle 2, requirement-interpreter:
`Ambiguity resolution must identify a removed prior ambiguity and explain the correction.`
The raw output and failed audit entry remain intact. The interpreter prompt and
transition policy were not changed to make this workflow pass.

## Changes

- Reviewer: complete non-ambiguity finding example, mandatory empty ambiguityRefs,
  scalar/indexed citations, exact whitespace/artifact attribution, exhaustive
  current ambiguity coverage, and the complete existing output schema in the prompt.
- Writer: exact-template instructions, a worked example preserving source literal
  backslashes through nested JSON escaping, and a verbatim "or", not "and" example.
- Regression replay: original reviewer/writer failures and all seven unsuccessful
  Batch A responses remain rejected; exact controls and worked examples validate.
- Runtime validators, schemas, coordinator policy, interpreter prompt, scorer,
  gold labels, archival baseline configuration, and F6 iteration documents stay unchanged.

The schema-delivery fallback was applied only after Batch A demonstrated that
examples alone were insufficient. The original collection seals and source
snapshots preserve both executed variants. No response is silently repaired.

## Evidence And Verification

- `comparison.json`: latest batch, original before results, all case identities,
  every workflow status, and explicit denominators.
- `all-attempts.json`: both batches' attempts, cumulative rates, manifest hashes,
  and usage; `diagnostics.json`: all eight new rejected responses.
- `runs/`, `audit.jsonl`, `receipts/`, `workflows/`: raw, parsed, input, prompt,
  request, and validated artifacts where actually produced.
- `source/`, `source-state.json`, `collection-plan.json`: executed source and
  pre-execution case/budget declarations; no secrets or dotenv files copied.
- `runtime-verification.json`: offline revalidation of all 73 responses; 65
  accepted artifacts and 8 preserved rejections; all 11 accepted writer reports
  exactly satisfy the unchanged report contract.
- `verification-tests.txt`: 81/81 tests pass; local coverage audit passes
  (not a model-performance or examiner-parser claim).
- `manifest.json`: immutable original collection seal; `manifest-final.json`:
  inventory seal including this report and subsequent offline verification.

Offline replay, no model/network calls:

```text
node evidence/f3-20261030T2225Z/verify-f3.js
node src/evidence-package.js evidence/f3-20261030T2218Z
node src/evidence-package.js evidence/f3-20261030T2225Z
npm test
```

These observations demonstrate bounded F3 contract behavior, not repeat-run
reliability or semantic correctness. No F6 baseline acceptance changes,
prompt-cycle ledger, historical claim reconstruction, or F6 closure is attempted.
