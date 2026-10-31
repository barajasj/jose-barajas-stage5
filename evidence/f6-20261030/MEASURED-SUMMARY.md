# F6 Measured Results Summary

Actual calls: 84/84; responses: 84; runtime accepted/rejected: 79/5; strict passes/failures: 10/74. No retries or repairs.
Provider-reported tokens: 190601 prompt + 129491 completion = 320092 total.
Measurement integrity: PASS; latest-candidate strict acceptance: FAIL.

Baseline exclusions, eligible identities, unmatched cases and paired deltas: [baseline-comparison.json](baseline-comparison.json).
Full before/after table: [improvement-table.csv](improvement-table.csv). Machine ledger: [prompt-evolution-ledger.json](prompt-evolution-ledger.json). All attempts: [all-attempts.json](all-attempts.json).

## Per-Agent Results

| Agent | v0 Strict / Runtime | v1 Strict / Runtime | v2 Strict / Runtime |
|---|---|---|---|
| requirement-interpreter | 0/8 / 8/8 | 0/8 / 8/8 | 0/8 / 8/8 |
| adversarial-reviewer | 0/16 / 15/16 | 0/16 / 16/16 | 0/16 / 14/16 |
| final-review-writer | 3/4 / 3/4 | 3/4 / 3/4 | 4/4 / 4/4 |

### requirement-interpreter

| Criterion | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |
|---|---:|---:|---:|---:|---:|
| requirementExtractionAccuracy | 15.4% | 12.8% | 7.7% | -2.6 pp | -5.1 pp |
| hvacTerminologyRecognition | 77.6% | 81.6% | 79.6% | +4.1 pp | -2.0 pp |
| ambiguityDetection | 18.2% | 18.2% | 18.2% | +0.0 pp | +0.0 pp |
| summaryAccuracy | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| developerConsiderationGrounding | 25.0% | 25.0% | 25.0% | +0.0 pp | +0.0 pp |
| confidencePolicyConsistency | 87.5% | 100.0% | 100.0% | +12.5 pp | +0.0 pp |

| Non-Compensable Gate | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |
|---|---:|---:|---:|---:|---:|
| rawResponseFormat | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| schemaConformance | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| sourceGrounding | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| redispatchSafety | 87.5% | 87.5% | 87.5% | +0.0 pp | +0.0 pp |

### adversarial-reviewer

| Criterion | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |
|---|---:|---:|---:|---:|---:|
| unsupportedAssumptionDetection | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| missingRequirementDetection | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| hvacInterpretationErrorDetection | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| missingValidationDetection | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| ambiguityDetection | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| boundaryChallengeCoverage | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| challengeQuality | 3.1% | 3.1% | 0.0% | +0.0 pp | -3.1 pp |

| Non-Compensable Gate | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |
|---|---:|---:|---:|---:|---:|
| rawResponseFormat | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| schemaConformance | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| runtimeContract | 93.8% | 100.0% | 87.5% | +6.3 pp | -12.5 pp |
| falsePositiveControl | 18.8% | 31.3% | 18.8% | +12.5 pp | -12.5 pp |
| rationaleGrounding | 0.0% | 0.0% | 0.0% | +0.0 pp | +0.0 pp |
| concernContinuity | 87.5% | 87.5% | 75.0% | +0.0 pp | -12.5 pp |

### final-review-writer

| Criterion | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |
|---|---:|---:|---:|---:|---:|
| findingPreservation | 75.0% | 75.0% | 100.0% | +0.0 pp | +25.0 pp |
| reportCompleteness | 92.9% | 92.9% | 100.0% | +0.0 pp | +7.1 pp |
| outputQuality | 87.5% | 87.5% | 100.0% | +0.0 pp | +12.5 pp |

| Non-Compensable Gate | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |
|---|---:|---:|---:|---:|---:|
| rawResponseFormat | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| schemaConformance | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| upstreamContract | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| reportStructure | 100.0% | 100.0% | 100.0% | +0.0 pp | +0.0 pp |
| conclusionGrounding | 75.0% | 75.0% | 100.0% | +0.0 pp | +25.0 pp |
| boundedReport | 75.0% | 75.0% | 100.0% | +0.0 pp | +25.0 pp |

## Runtime Rejections

| Version | Case | Rejection | Attempt Evidence |
|---|---|---|---|
| v0 | retained | GOVERNANCE_FAILURE: Prior findings disappeared without sourced resolutions. | [v0/retained-attempt.json](v0/retained-attempt.json) |
| v0 | ticket4-final-review-writer | GOVERNANCE_FAILURE: Final report violates the supplied artifact content contract. | [v0/ticket4-final-review-writer-attempt.json](v0/ticket4-final-review-writer-attempt.json) |
| v1 | ticket4-final-review-writer | GOVERNANCE_FAILURE: Final report violates the supplied artifact content contract. | [v1/ticket4-final-review-writer-attempt.json](v1/ticket4-final-review-writer-attempt.json) |
| v2 | hvac | GOVERNANCE_FAILURE: Source quote is not present in the referenced artifact. | [v2/hvac-attempt.json](v2/hvac-attempt.json) |
| v2 | validation | GOVERNANCE_FAILURE: Source quote is not present in the referenced artifact. | [v2/validation-attempt.json](v2/validation-attempt.json) |

## Complete Case Index

Cells show runtime result / strict result, linking to every attempt, not just successes.

| Case | v0 | v1 | v2 |
|---|---|---|---|
| dx | [SUCCESS / FAIL](v0/dx-attempt.json) | [SUCCESS / FAIL](v1/dx-attempt.json) | [SUCCESS / FAIL](v2/dx-attempt.json) |
| coil | [SUCCESS / FAIL](v0/coil-attempt.json) | [SUCCESS / FAIL](v1/coil-attempt.json) | [SUCCESS / FAIL](v2/coil-attempt.json) |
| filters | [SUCCESS / FAIL](v0/filters-attempt.json) | [SUCCESS / FAIL](v1/filters-attempt.json) | [SUCCESS / FAIL](v2/filters-attempt.json) |
| clean | [SUCCESS / FAIL](v0/clean-attempt.json) | [SUCCESS / FAIL](v1/clean-attempt.json) | [SUCCESS / FAIL](v2/clean-attempt.json) |
| sparse | [SUCCESS / FAIL](v0/sparse-attempt.json) | [SUCCESS / FAIL](v1/sparse-attempt.json) | [SUCCESS / FAIL](v2/sparse-attempt.json) |
| conflict | [SUCCESS / FAIL](v0/conflict-attempt.json) | [SUCCESS / FAIL](v1/conflict-attempt.json) | [SUCCESS / FAIL](v2/conflict-attempt.json) |
| redispatch | [SUCCESS / FAIL](v0/redispatch-attempt.json) | [SUCCESS / FAIL](v1/redispatch-attempt.json) | [SUCCESS / FAIL](v2/redispatch-attempt.json) |
| assumption | [SUCCESS / FAIL](v0/assumption-attempt.json) | [SUCCESS / FAIL](v1/assumption-attempt.json) | [SUCCESS / FAIL](v2/assumption-attempt.json) |
| missing | [SUCCESS / FAIL](v0/missing-attempt.json) | [SUCCESS / FAIL](v1/missing-attempt.json) | [SUCCESS / FAIL](v2/missing-attempt.json) |
| hvac | [SUCCESS / FAIL](v0/hvac-attempt.json) | [SUCCESS / FAIL](v1/hvac-attempt.json) | [GOVERNANCE_FAILURE / FAIL](v2/hvac-attempt.json) |
| validation | [SUCCESS / FAIL](v0/validation-attempt.json) | [SUCCESS / FAIL](v1/validation-attempt.json) | [GOVERNANCE_FAILURE / FAIL](v2/validation-attempt.json) |
| missed-ambiguity | [SUCCESS / FAIL](v0/missed-ambiguity-attempt.json) | [SUCCESS / FAIL](v1/missed-ambiguity-attempt.json) | [SUCCESS / FAIL](v2/missed-ambiguity-attempt.json) |
| open | [SUCCESS / FAIL](v0/open-attempt.json) | [SUCCESS / FAIL](v1/open-attempt.json) | [SUCCESS / FAIL](v2/open-attempt.json) |
| boundary | [SUCCESS / FAIL](v0/boundary-attempt.json) | [SUCCESS / FAIL](v1/boundary-attempt.json) | [SUCCESS / FAIL](v2/boundary-attempt.json) |
| clean-review | [SUCCESS / FAIL](v0/clean-review-attempt.json) | [SUCCESS / FAIL](v1/clean-review-attempt.json) | [SUCCESS / FAIL](v2/clean-review-attempt.json) |
| minor-label | [SUCCESS / FAIL](v0/minor-label-attempt.json) | [SUCCESS / FAIL](v1/minor-label-attempt.json) | [SUCCESS / FAIL](v2/minor-label-attempt.json) |
| retained | [GOVERNANCE_FAILURE / FAIL](v0/retained-attempt.json) | [SUCCESS / FAIL](v1/retained-attempt.json) | [SUCCESS / FAIL](v2/retained-attempt.json) |
| resolved | [SUCCESS / FAIL](v0/resolved-attempt.json) | [SUCCESS / FAIL](v1/resolved-attempt.json) | [SUCCESS / FAIL](v2/resolved-attempt.json) |
| bad-resolution | [SUCCESS / FAIL](v0/bad-resolution-attempt.json) | [SUCCESS / FAIL](v1/bad-resolution-attempt.json) | [SUCCESS / FAIL](v2/bad-resolution-attempt.json) |
| writer-fail | [SUCCESS / PASS](v0/writer-fail-attempt.json) | [SUCCESS / PASS](v1/writer-fail-attempt.json) | [SUCCESS / PASS](v2/writer-fail-attempt.json) |
| writer-pass | [SUCCESS / PASS](v0/writer-pass-attempt.json) | [SUCCESS / PASS](v1/writer-pass-attempt.json) | [SUCCESS / PASS](v2/writer-pass-attempt.json) |
| condenser | [SUCCESS / FAIL](v0/condenser-attempt.json) | [SUCCESS / FAIL](v1/condenser-attempt.json) | [SUCCESS / FAIL](v2/condenser-attempt.json) |
| missing-corrected | [SUCCESS / FAIL](v0/missing-corrected-attempt.json) | [SUCCESS / FAIL](v1/missing-corrected-attempt.json) | [SUCCESS / FAIL](v2/missing-corrected-attempt.json) |
| assumption-corrected | [SUCCESS / FAIL](v0/assumption-corrected-attempt.json) | [SUCCESS / FAIL](v1/assumption-corrected-attempt.json) | [SUCCESS / FAIL](v2/assumption-corrected-attempt.json) |
| hvac-corrected | [SUCCESS / FAIL](v0/hvac-corrected-attempt.json) | [SUCCESS / FAIL](v1/hvac-corrected-attempt.json) | [SUCCESS / FAIL](v2/hvac-corrected-attempt.json) |
| validation-corrected | [SUCCESS / FAIL](v0/validation-corrected-attempt.json) | [SUCCESS / FAIL](v1/validation-corrected-attempt.json) | [SUCCESS / FAIL](v2/validation-corrected-attempt.json) |
| ticket4-final-review-writer | [GOVERNANCE_FAILURE / FAIL](v0/ticket4-final-review-writer-attempt.json) | [GOVERNANCE_FAILURE / FAIL](v1/ticket4-final-review-writer-attempt.json) | [SUCCESS / PASS](v2/ticket4-final-review-writer-attempt.json) |
| ticket5-final-review-writer | [SUCCESS / PASS](v0/ticket5-final-review-writer-attempt.json) | [SUCCESS / PASS](v1/ticket5-final-review-writer-attempt.json) | [SUCCESS / PASS](v2/ticket5-final-review-writer-attempt.json) |

## Interpretation And Limits

- The corrected bounded scorer and labels are unchanged. Strict-label failures are not automatically semantic error estimates.
- Positive and negative deltas are descriptive observations on this small development suite, not causal or statistical proof.
- v0 is a newly collected baseline; no historical export was upgraded or relabeled as a compatible run.
- Candidates were genuinely changed and measured twice per agent. A measured cycle is not necessarily a successful improvement.
- No production prompts are promoted; no additional workflows or remediation streams were started.
- The full evaluator snapshots retain old Deliverable 5 workflow failures. They are not new F3 workflow attempts or evidence that the completed F3 remediation regressed.
- preflight.json, interim-v0.json, and interim-v1.json are retained intermediate snapshots, not final acceptance reports.

## Reproduction

```text
node src/run-f6.js evidence/f6-20261030
node src/evidence-package.js evidence/f6-20261030
npm test
npm run eval:controls
npm run eval:coverage
```

Pinned measurement identity: content-v3-reviewed-equivalents, SHA-256 08218b2c6568063db18d49c68d07c72b3c064b8cde296675438ce5f7ba582a76.
The collection source snapshot and original plan are preserved; finalized documentation is added separately without overwriting them.
