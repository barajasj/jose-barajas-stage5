# F6 Review Handoff

The authorized F6 experiment is complete. This handoff distinguishes a valid
measurement trail from successful model acceptance; it does not claim an
unconditional certification PASS.

## Finding Status

| Finding | Evidence-Supported Status | Remaining Qualification |
|---|---|---|
| F6a | Addressed: three original incompatible exports are explicitly excluded from current acceptance; 28 genuine prospective pairs exist for each of two cycles | No history fabricated; required missing/incompatible measurements still fail closed |
| F6b measured change cycles | Addressed: two actual template changes per agent, all 84 observations, exact diffs/hypotheses, frozen scorer/labels/contracts, and reproducible before/after results | Single development-suite observations are not repeat-run reliability or causal proof |
| F6b improvement evidence | Mixed: each agent has a positive criterion/gate change in one cycle; every zero/negative change is published | Two successful improvements per agent and uniform final-version gains are not demonstrated |
| Overall model/certification acceptance | Not established; latest-candidate strict acceptance is FAIL | No production candidate is promoted; other remediation streams were not opened |

## Measurements

| Agent | v0 Runtime / Strict | v1 Runtime / Strict | v2 Runtime / Strict | Supported Positive Observation | Negative/Zero Observation |
|---|---|---|---|---|---|
| Requirement Interpreter | 8/8 / 0/8 | 8/8 / 0/8 | 8/8 / 0/8 | Confidence-policy 7/8 -> 8/8 in cycle 1 (+12.5 pp) | Extraction matches 6/39 -> 5/39 -> 3/39; no full-step passes |
| Adversarial Reviewer | 15/16 / 0/16 | 16/16 / 0/16 | 14/16 / 0/16 | Runtime acceptance +6.25 pp in cycle 1 | Cycle 2 -12.5 pp; two invalid source quotes; no full-step passes |
| Final Review Writer | 3/4 / 3/4 | 3/4 / 3/4 | 4/4 / 4/4 | Strict fidelity +25 pp in cycle 2 | Cycle 1 unchanged; both earlier nested-escaping failures remain retained |

Strict bounded-label scoring failures do not automatically prove semantic errors.
The observed citation, prior-ID, and exact writer-fidelity rejections are genuine
runtime contract failures. Both kinds of results remain visible and separate.

All 84 calls returned raw responses. Runtime acceptance is 79/84; five rejections
are retained. Strict acceptance across all versions is 10/84. Each comparison has
28 eligible pairs, zero unmatched current cases, and zero baseline-only cases.
There were no retries, silent repairs, workflow reruns, or extra API calls.

## Files And Evidence

- [Implementation files changed/added](implementation-files.json).
- [Baseline comparison report](F6-REPORT.md) and [strict pair identities](baseline-comparison.json).
- [Improvement table](improvement-table.csv), [measured summary](MEASURED-SUMMARY.md),
  and [full unrounded results](measured-results.json).
- [Prompt versions/reasons/outcomes](prompt-evolution-ledger.json) and six exact
  diffs in `prompt-diffs/`; full templates remain under `prompts/v0/` to `v2/`.
- [Every attempt](all-attempts.json), [runtime rejection diagnostics](runtime-rejections.json),
  and all per-version raw/input/prompt/request/parsed/validated artifacts.
- [Preserved historical package verification](preservation-verification.json);
  all 1,565 tracked historical evidence files remain hash-matched to the plan.
- Preflight, both intermediate result snapshots, and pre-collection verification
  files remain intact. They are not substituted for final measurements.

## Pass-Risk Assessment

High for unconditional certification PASS. Baseline validity and measurement
traceability are now demonstrated, but the latest reviewer candidate regresses,
interpreter/reviewer strict thresholds remain unmet, and two positive cycles per
agent are not shown. Writer v2 is only four fixed direct inputs, not universal
fidelity, new workflow completion, or F4 closure.

No collection or integrity blocker remains. The unresolved issue is performance
and the strength of the improvement claim, not missing observations. The approved
84-call budget is exhausted. No further live experiments or unrelated remediation
are started; this package is ready for review.

## Offline Reproduction

Fresh verification: 89/89 tests pass; 61 coverage checks and 152 negative controls
pass; corrected-scorer authored controls pass; replay exactly matches saved
measurements. Full evaluator acceptance remains FAIL, with its F6 comparison
passing and four preserved Deliverable 5 workflow-evidence errors still reported.
Final logs and machine checks are under `verification/`.

```text
npm run eval:f6
node src/evidence-package.js evidence/f6-20261030
npm test
npm run eval:controls
npm run eval:coverage
```

`eval:f6` exits zero for measurement integrity; its `modelAcceptancePass: false`
is deliberately retained. The full evaluator snapshots include preserved
Deliverable 5 workflow failures, not new failures of the completed F3 remediation.
The original collection seal and source snapshot are retained; the final seal
also covers supplemental reports, final verification, and finalized documentation.
