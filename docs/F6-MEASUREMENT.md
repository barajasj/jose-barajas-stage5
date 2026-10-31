# F6 Measurement Protocol

Status: authorized collection complete. 84/84 calls returned raw responses;
79 passed runtime validation and five were rejected. Both prompt-change cycles
have 28 eligible pairs with no unmatched cases. Measurement integrity passes;
latest-candidate model acceptance fails. No further live calls are authorized by
this completed experiment.

Results: [measured summary](../evidence/f6-20261030/MEASURED-SUMMARY.md),
[baseline report](../evidence/f6-20261030/F6-REPORT.md),
[all attempts](../evidence/f6-20261030/all-attempts.json).
There are two measured changes per agent, but only one cycle per agent has any
positive criterion/gate delta. Mixed results and regressions are not relabeled
successful improvement.

Scope: F6a/F6b only. F2 scorer/labels and F3 validators remain unchanged.
Production prompts stay unchanged; candidates are versioned independently.

## Fixed Design

- 28 fixed inputs: all 26 reviewed direct cases, plus the preserved ticket-4 and
  positive-control writer inputs that previously exposed fidelity failures.
- Three prompt versions per agent: unchanged post-F3 v0, task-decomposition v1,
  then cumulative final-audit v2. Exact revisions: `evals/f6-iterations.js`.
- 84 calls maximum, one observation per case/version, temperature 0, same model,
  schemas, prompt builder, governance contracts, labels, and corrected scorer.
- No SDK retries, automatic retries, output repair, or deletion of failed attempts.
  An interrupted version cannot be overwritten or resumed as a clean run.
- Both change cycles are measured, including zero/negative deltas. There is no
  promise that either hypothesis will improve behavior.

## Baselines

Original `4fcbf47` exports remain byte-identical. Current definitions mark them
`archival-incompatible`; the runner verifies their incompatibility and reports
their exclusions separately from current acceptance. Missing/corrupt required
baselines still fail. A compatible artifact cannot simply be declared incompatible.

Prospective v0 supplies cycle-1 baselines; v1 supplies cycle-2 baselines. Each
comparison requires identical case/agent/input/model/settings/scorer/schema/
governance/report-contract/label identity, and a changed prompt-template hash.
Raw rejections count as negative observations. Missing raw responses are retained
failures, never fabricated observations or valid pairs.

`evals/test-cases.json.promptComparison` requires both complete comparable cycles.
Missing prospective evidence fails current acceptance rather than making excluded
historical baselines a permissive default.

## Collection

The following commands describe the completed collection. They intentionally
refuse an existing target; do not rerun them on this preserved package. A new
experiment needs a new directory and separate API authorization:

```text
node src/f6-plan.js evidence/NEW-F6-PACKAGE
node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v0 --allow-live
node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v1 --allow-live
node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v2 --allow-live
node src/run-f6.js evidence/NEW-F6-PACKAGE --write
```

Preparation freezes input/gold hashes, full prompt templates, revision hypotheses,
source snapshots, scorer identity, and hashes of all tracked historical evidence.
Do not edit source or the planned templates during collection. A new experiment
requires a new directory; every prior directory stays discoverable.

Each call persists started and finished receipts, case attempt records, audit,
input, built prompt, request provenance, raw response, and parsed/validated output
where produced. The reporter revalidates runtime decisions and rescoring from raw
responses, publishes every case/gate/metric delta, and seals the package.

## Offline Verification

```text
npm test
npm run eval:controls
npm run eval:coverage
npm run eval:f6
node src/evidence-package.js evidence/f6-20261030
```

`npm run eval:f6` compares fresh recomputed results with the saved report and
checks the package seal. Its zero exit means measurement integrity, not model
acceptance; `modelAcceptancePass` remains false. Full evaluator runs retain the
old Deliverable 5 workflow failures; they do not rerun or supersede completed F3
workflow evidence.

Generated outputs:

- `F6-REPORT.md`: improvement table, baseline exclusions, eligible/unmatched pairs,
  iteration ledger, limitations, evidence locations, and reproduction commands.
- `measured-results.json`: all attempts, strict/runtime/gate/criterion results,
  pooled metrics, and both cycles' paired deltas.
- `evaluations/v0.json` through `v2.json`: fresh corrected-scorer evaluator runs,
  including preserved workflow acceptance failures rather than hiding them.
- `fresh-coverage.json`: fresh instruction coverage and sensitivity evaluation of
  the unchanged production prompts. It is not a model-performance measurement.
- `baseline-comparison.json`, `improvement-table.csv`, `MEASURED-SUMMARY.md`:
  paired identities, exclusions, all criteria/gate deltas, and a complete case index.
- `prompt-evolution-ledger.json`, `prompt-diffs/`: exact version hashes,
  reasons/instructions, measured outcomes, and all six genuine prompt diffs.
- `all-attempts.json`, `runtime-rejections.json`: 84 calls, every failure,
  provider-reported usage, and exact escaping/citation/continuity diagnostics.
- `manifest.json`: original collection seal. `manifest-final.json`: final
  inventory including the unchanged original seal and finalized documentation.
  Neither is independent provider attestation.

Preflight and intermediate snapshots remain in place. Final documentation is
copied separately under `verification/docs/`; the original pre-collection
`source/` snapshot is not rewritten to pretend the results were known earlier.

Measurement integrity, model acceptance, and positive prompt effects are separate
outcomes. A valid trail alone is not overall certification readiness. These are
small development-suite observations, not held-out or statistically significant
results. No production candidate is promoted automatically.
