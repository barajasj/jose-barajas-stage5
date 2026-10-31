# F6 Baseline Comparison And Measured Results

Measurement integrity: PASS. Latest-candidate strict model acceptance: FAIL.

These are prospective, paired prompt-version observations, not reconstructed historical improvements. A valid measurement trail does not establish that a prompt change improved performance.

## Improvement Table

| Agent | Cycle | Strict Before | Strict After | Strict Delta | Runtime Before | Runtime After | Runtime Delta | Any Positive Criterion/Gate Delta |
|---|---|---:|---:|---:|---:|---:|---:|---|
| requirement-interpreter | v0->v1 | 0.0% | 0.0% | +0.0 pp | 100.0% | 100.0% | +0.0 pp | true |
| adversarial-reviewer | v0->v1 | 0.0% | 0.0% | +0.0 pp | 93.8% | 100.0% | +6.3 pp | true |
| final-review-writer | v0->v1 | 75.0% | 75.0% | +0.0 pp | 75.0% | 75.0% | +0.0 pp | false |
| requirement-interpreter | v1->v2 | 0.0% | 0.0% | +0.0 pp | 100.0% | 100.0% | +0.0 pp | false |
| adversarial-reviewer | v1->v2 | 0.0% | 0.0% | +0.0 pp | 100.0% | 87.5% | -12.5 pp | false |
| final-review-writer | v1->v2 | 75.0% | 100.0% | +25.0 pp | 75.0% | 100.0% | +25.0 pp | true |

## Baseline Validity

Eligible baselines are fresh v0 observations; v1 is the baseline for cycle 2. Each pair requires identical case, agent, input, model/settings, schema, runtime contracts, labels, and scorer. Prompt templates must differ. Failed raw generations remain eligible negative observations; missing raw responses cannot form a pair.

| Archival File | Original SHA-256 | Exclusion Observed |
|---|---|---|
| evidence/d5-20261030T1940Z/baselines/ticket1-run.json | 8237e7b2e025d93cd0f364461abbf35cb5f9cfa804af6e40dc77c3e898b3152e | Workflow must have an explicit completed status. |
| evidence/d5-20261030T1940Z/baselines/ticket2-run.json | 3c978cefac8052c880036b1d8e92956be515110033e533e8922169c0dd0be8ad | Workflow must have an explicit completed status. |
| evidence/d5-20261030T1940Z/baselines/ticket3-run.json | 982629ac9c0c29c6a91f4406a7ce84ea4745a35b69f5214c416fa785c72db3f5 | Workflow must have an explicit completed status. |

v0->v1: 28 eligible pairs; unmatched current: []; baseline-only: [].

v1->v2: 28 eligible pairs; unmatched current: []; baseline-only: [].

## Version Ledger

| Version | Reason/Hypothesis | Prompt Evidence | Measurements |
|---|---|---|---|
| v0 | Prospective baseline: unchanged post-F3 production prompts, not reconstructed historical performance. | evidence/f6-20261030/prompts/v0/; SHA-256 and exact added instructions in collection-plan.json | measured-results.json#versions/v0; v0/attempts.json |
| v1 | Separate extraction, review comparison, and literal transcription from speculative completion. | evidence/f6-20261030/prompts/v1/; SHA-256 and exact added instructions in collection-plan.json | measured-results.json#versions/v1; v1/attempts.json |
| v2 | Add a final omission/identity/character audit after the v1 task decomposition; no new facts or output repair. | evidence/f6-20261030/prompts/v2/; SHA-256 and exact added instructions in collection-plan.json | measured-results.json#versions/v2; v2/attempts.json |

## Reproduction

```text
node src/run-f6.js evidence/f6-20261030
node src/evidence-package.js evidence/f6-20261030
npm test
npm run eval:controls
npm run eval:coverage
```

Offline replay revalidates original raw/input/prompt/request/validated artifacts, audit outcomes, receipts, frozen scorer/labels, strict pair identities, and hashes of all tracked historical evidence. No API calls or response repair occur during replay.

Fresh collection uses a NEW directory, then v0, v1, v2 in order. It requires explicit network authorization:

```text
node src/f6-plan.js evidence/NEW-F6-PACKAGE
node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v0 --allow-live
node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v1 --allow-live
node src/collect-f6-evidence.js evidence/NEW-F6-PACKAGE v2 --allow-live
node src/run-f6.js evidence/NEW-F6-PACKAGE --write
```

## Limitations And Blockers

- Small development suite, not held-out evaluation; single observation per case/version.
- Temperature zero is not a reproducibility guarantee; no causal or statistical-significance claim.
- Corrected bounded scorer stays frozen; unsupported formulations may lack credit. No post-response label expansion.
- No workflow, F4, or overall certification PASS claim.
- All attempts count. Runtime acceptance, exact-label scoring, and workflow completion are different measurements.
- Positive metric/gate changes are descriptive, not statistical proof; mixed or zero changes are not labeled improvements.
- Existing workflow and semantic acceptance failures remain reported separately; this stream does not remediate them.

Full metrics, per-case deltas, gates, unmatched identities, raw artifact paths, and negative changes: evidence/f6-20261030/measured-results.json.
Fresh evaluator replay (including preserved workflow failures): evidence/f6-20261030/evaluations/; fresh coverage/sensitivity: evidence/f6-20261030/fresh-coverage.json.

No production prompt is promoted automatically; versioned candidates remain reviewable.
