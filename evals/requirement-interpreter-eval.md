# HVAC Requirement Interpreter Evaluation

## Current Live Evidence - Deliverable 5

Authoritative package: `evidence/d5-20261030T1940Z/`, collected 2026-10-30.
All 26 direct cases have untouched real responses; all 15 mandatory metric types
have applicable direct observations. Only 2/26 direct cases pass the unchanged
strict scorer (both writer cases). This is exact-label compliance, not general
semantic accuracy: paraphrases do not receive credit.

Current `after-labeled.json`: FAIL, seven evidence errors and 26 failed scored steps.
Ticket 1 completed with FAIL and contributes three measured workflow steps.
Ticket 2 lacks `ambiguityRefs`; ticket 3 has an invalid source quotation; ticket 4
and the positive control changed bounded report content. Three original baseline
exports lack completed status/cycle/provenance. No statuses or responses were repaired.
`diagnostics.json` traces every error, failed gate, and failed metric.

The current definitions load `responseFile` automatically; `--responses FILE`
overrides it. `workflowLabelsFile` supplies hash-bound, non-overriding contexts for
new workflow inputs. Ticket-1 review labels were authored after collection from
its frozen upstream input and original ticket, not from its candidate review;
they are not blinded measurements. Fixed direct-case gold remains unchanged.

Use `node src/run-evals.js` for offline replay (exit 1 is expected), and
`node src/evidence-package.js evidence/d5-20261030T1940Z` for package integrity.
`before.json`, `after.json`, and `after-labeled.json` retain each evaluation stage.
Historical files below remain historical; no new prompt-iteration delta is claimed.

## Current scorer - Deliverable 4

`src/eval-scorer.js` now uses `content-v3-reviewed-equivalents`, replacing exact-only semantic wording checks with independently reviewed proposition-equivalent phrasings while retaining exact schema, source-quote, reference, numeric, and polarity checks. Reviewer findings are matched one-to-one against complete authored concern labels: supported additional concerns are accepted only when labeled; ungrounded extras remain a hard failure. Existing thresholds remain unchanged. `evals/test-cases.json` identifies workflow artifacts; `evals/step-cases.js` supplies fixed direct-step cases with authored labels, including all four HVAC fixtures, sparse/conflicting tickets, corrected reviewer counterparts, and clean PASS/concern-bearing FAIL reports.

Commands (offline, no model invocation):

```text
npm test
node src/run-evals.js --self-test
node src/run-evals.js
```

`--self-test` checks authored full-step controls plus the Deliverable 3 coverage/sensitivity audit. It reports `mode: authored-controls` and `modelPerformanceMeasured: false`; its PASS is not a model score. The test suite also exercises all 152 D3 mutations against the integrated scorer and the original false-credit counterexamples.

Without `--self-test`, missing direct responses, incomplete workflows, incompatible old artifacts, missing required baselines, and unmeasured mandatory criteria fail with exit code 1. Current definitions select the live batch above; remaining failures are recorded rather than repaired. No legacy artifact is upgraded or given a fabricated default.

Content rules:

- Business rules, terms, and ambiguities match complete field-specific gold propositions (case/whitespace normalization only). Changed quantities, units, conditions, polarity, and unsupported additions fail. Unlabeled paraphrases require reviewed gold variants, not keyword fallback.
- Summary, developer considerations, confidence policy, grounding, and re-dispatch preservation are executed, not presence checks.
- Applicable metrics have positive denominators. Source categories absent from an explicitly labeled case are NA (`score: null`, reason), never 1.0. Missing labels are configuration failures.
- Schema, runtime consistency, source grounding, false positives, and report integrity are non-compensable gates. Every required case must pass; pooled recall cannot hide a contract violation. Decisions use full precision.

### Persisted observation contract

`node src/run-evals.js --responses direct-responses.json` consumes a JSON object with an `observations` array, one entry for every ID in `evals/step-cases.js`. Each entry contains:

```text
caseId, agent, input, rawResponse,
provenance: {
  runtimeMode: "real", model, modelSettings: { temperature },
  correlationId, timestamp, inputHash, rawHash, promptHash, schemaHash
}
```

`input` must equal the frozen case input. `rawResponse` is the untouched response string, including malformed JSON if returned; do not strip fences. Hashes are SHA-256: `inputHash` uses `JSON.stringify(input)`, `rawHash` uses the response bytes. Parsed-only, mock, duplicate, unknown, or missing observations fail. Provenance records are consistency checks, not independent proof that a provider was contacted. Live collection now exists above; prompt-evolution measurements remain unproven.

Workflow evidence additionally requires completed status, explicit real mode, contiguous cycles, matching initial/final artifacts, and persisted per-step input, prompt, raw, validated output, and SUCCESS manifests. Hashes and cross-artifact governance are verified before scoring. Unknown interpreter/reviewer input contexts require frozen labels; expectations are never inferred from the candidate output or ticket ID alone.

`--definitions FILE` can select workflow/baseline artifacts using the version-2 format. Optional `responseFile` and `workflowLabelsFile` paths are repository-relative. Workflow labels contain `cases`, each with `id`, `agent`, `input` (or `inputFile`), `inputHash`, `gold`, and `provenance`; changed hashes, duplicate contexts, and overrides of fixed cases fail configuration. `baseline.state` is `required` (file, optionally immutable Git ref) or `not-in-baseline` with a reason. Tickets 1-3 now use byte-exact exports of `4fcbf47`, with Git origin metadata, so offline replay does not need `.git`. Ticket 4 and the new positive control have no historical baseline. Missing, corrupt, or contract-incompatible required baselines still fail.

`--baseline-responses FILE` optionally compares the same direct cases. Deltas require identical case/fixture identity, exact step input, model/settings, and current scorer hash. Expanded/unmatched cases are reported separately with no delta. Old keyword and content-v2 scores are never compared to content-v3-reviewed-equivalents scores.

Output is JSON on stdout. Optional `--output NEW_FILE` writes a new file only; existing files and `sub-agents-results.json` are protected. Historical results below remain historical, not refreshed measurements.

## Stage 3 load-bearing coverage — Deliverable 3

The legacy scoring methodology, results, and iteration log below are historical and have not been revalidated. This section measures instruction coverage and whether the new criteria distinguish authored valid outputs from targeted violations. It does not claim improved live-model accuracy or satisfy the separate prompt-evolution evidence requirement.

| Prompt Artifact | Examiner Coverage | New Local Coverage | Required Coverage | Previously Missing Criteria |
|---|---|---|---|---|
| Requirement Interpreter | 8/12 = 66.7% | 16/16 = 100% | >=90% independently; local preflight requires every retained unit | Summary, grounded developer considerations, readiness confidence; substantive validation and behavior |
| Adversarial Reviewer | 8/12 = 66.7% | 19/19 = 100% | >=90% independently | HVAC errors, missed/open ambiguities, ticket and interpreter grounding, severity impact |
| Final Review Writer | 6/8 = 75% | 12/12 = 100% | >=90% independently | Interpreter grounding, unsupported conclusions, substantive findings/disposition fidelity |

These are different inventories, not like-for-like performance deltas. The local denominator includes numbered instruction bullets, input slots, and appended re-dispatch instructions. It excludes Markdown headings used only as labels. The examiner's exact Markdown disassembler is unavailable; local 100% does not assert an official grader result.

### Executable artifacts and method

- `evals/load-bearing-map.json`: exact prompt/source hashes and unit-to-criterion mappings.
- `evals/load-bearing-cases.js`: fixed ticket/interpreter inputs, authored complete-proposition labels, valid outputs, and targeted mutations.
- `src/load-bearing-criteria.js`: named executable assertions. Full propositions and field values are compared, not isolated keyword presence.
- `src/run-load-bearing-audit.js`: executes the cases, verifies schema-valid content counterexamples, detects unmapped prose/list items/input slots, and includes dynamically appended instructions.
- `tests/load-bearing.test.js`: audit regressions and false-credit controls.
- Run `node src/run-load-bearing-audit.js`; use `--json` for per-case assertions, mappings, and normalized-text hashes. Run `node --test tests/load-bearing.test.js` for audit regressions.

Each applicable assertion is Boolean: valid counterpart accepted AND every targeted violation rejected. No empty-denominator recall credit is used. Content mutations must remain schema-valid; explicit JSON/schema/status violations are separately identified. A case without applicable labels is an evaluation-configuration error, not a pass.

Observed on this revision: all **61 valid counterparts accepted** and all **152 negative controls rejected** across the three agents. These are authored criterion-sensitivity measurements, not model executions. Gold proposition wording is deliberately conservative, with case/whitespace normalization only; scorer integration was completed in Deliverable 4. Broader paraphrase grading is not implemented.

### Interpreter instruction map

| Current Unit | Named Criterion | Case / Rejected Violation |
|---|---|---|
| I01 requirementSummary | summaryAccuracy | `summary`: changed range/unit or generic summary |
| I02 HVAC terminology | hvacTerminologyAccuracy, sourceGrounding | `terminology`: invented or omitted term |
| I03 explicit business rules | businessRuleAccuracy | `business-rules`: maximum instead of sum; omitted edit rule |
| I04 validation-rule content | validationRuleAccuracy, sourceGrounding, ambiguityAccuracy | `validation`, `coil-grounding`, `ambiguities`: each mapping, range limit, unit, override, or unanswered policy changed |
| I05 trigger/action/output behavior | functionalBehaviorAccuracy | `dx-functional`, `filters-functional`: wrong trigger or dependent output |
| I06 missing/contradictory details | ambiguityAccuracy | `ambiguities`: erased question or false claim that the specified Lamiflo increment is missing |
| I07 developer considerations | developerConsiderationGrounding | `dx-developer`, `filters-developer`: invented architecture/reset policy or missing supported constraint |
| I08 readiness confidence | confidencePolicyConsistency | `clean-confidence`, `dx-confidence`, `sparse-confidence`, `conflict-confidence`: wrong HIGH/MEDIUM/LOW class |
| I09 no unsupported inference | sourceGrounding | `coil-grounding`, `filters-grounding`: invented clamp/inactive-option policy or summary from another ticket |
| I10 empty arrays versus real questions | emptyArrayDiscipline | `empty-arrays`: invented terms/rules/technical policy or removed question on a sparse ticket |
| I11 re-dispatch safety | redispatchSafety | `redispatch`: erased unresolved question, invented validation, or irrelevant-but-real resolution quotation |
| I12 JSON/schema contract | rawResponseFormat, schemaConformance | `requirement-interpreter-raw/schema`: fences, surrounding prose, array root, wrong types, extra field |
| Ticket input slot | summaryAccuracy, sourceGrounding | Ticket-specific complete propositions; unrelated-ticket summary rejected |
| Appended previous interpretation | redispatchSafety | Same fixed previous interpretation and explicitly sourced correction |
| Appended reviewer feedback | redispatchSafety, sourceGrounding | Required correction captured without fabricating absent validation policy |
| Appended ambiguity preservation | redispatchSafety | Prior unanswered questions retained; only a genuinely answered question is removed |

### Examiner unit reconciliation and preferred treatment

| Original Unit(s) | Original Gap | Preferred Action Implemented |
|---|---|---|
| 6, 10: developer considerations | Unmeasured and broad enough to invite implementation invention | **Rewrite + test** as source-supported technical constraints; retain the field |
| 7: requirementSummary | Not read by a criterion | **Test** requested action, objects, conditions, and numeric content |
| 12: confidence | Enum/schema membership only | **Rewrite + test** readiness confidence: complete source HIGH, localized gaps MEDIUM, missing/contradictory core LOW |
| 3: validation rules | Partial ambiguity keyword checks | **Test directly** all explicit ranges, units, rounding, and mapping content |
| 4: functional behavior | Indirect business-rule keywords | **Test directly** trigger, action, and affected output |
| 1, 8: HVAC terminology | Existing mapping | Retain under I02 with full term/source support checks |
| 2, 9: business rules | Existing mapping | Retain under I03 with complete propositions |
| 5, 11: ambiguities | Existing mapping | Retain under I06 with omissions and false-ambiguity controls |

All original substantive instruction families remain represented. Repeated JSON-format paragraphs and duplicate field/example prose were consolidated into I12, not silently excluded. Unsupported generic developer advice was narrowed, not disguised as a mandatory business requirement. Runtime governance and schemas from Deliverable 2 are unchanged.

## Historical evaluation record — not refreshed by Deliverable 3

## Purpose

Evaluate the HVAC Requirement Interpreter agent.

## Evaluation Criteria

### Criterion 1
Requirement Extraction Accuracy

Definition:
Correctly identifies explicit requirements from the ticket.

Success Threshold:
90%

---

### Criterion 2
HVAC Terminology Recognition

Definition:
Correctly identifies HVAC concepts, terminology, and business meaning.

Success Threshold:
90%

---

### Criterion 3
Ambiguity Detection

Definition:
Correctly identifies missing information and implementation uncertainties.

Success Threshold:
80%

---

## Test Artifacts

- fixtures/hvac-ticket-1.md
- fixtures/hvac-ticket-2.md
- fixtures/hvac-ticket-3.md
- fixtures/hvac-ticket-4.md

## Test Case Definitions

Defined in `evals/test-cases.json` under
`requirementInterpreter` for each fixture:

- `expectedBusinessRules`: the explicit rules the
  ticket states (matched against `businessRules`).
- `expectedHvacTerms`: the HVAC terms present in the
  ticket (matched against `hvacTerminology`).
- `expectedAmbiguities`: the underspecified areas a
  correct interpretation must surface (matched
  against `ambiguities`).

Each expected item carries an `id`, a human-readable
`expectation`, and an `anyOf` keyword list. An item
is scored 1 when ANY keyword appears as a
case-insensitive substring in the output field,
else 0.

Examples:

- hvac-ticket-1: expects the DX Coil Height = sum of
  circuit heights rule, Cooling Package trigger, and
  recalculation-on-edit rule; expects ambiguities
  covering missing validation rules, undefined
  units, dynamic circuit add/remove, and circuit
  data source.
- hvac-ticket-4: expects the 1.25"-100" range rule,
  the multiple-of-increment rule, the
  round-to-nearest rule, and the Lamiflo/1" tube
  increments; expects ambiguities covering
  tie-breaking, spacing detection, out-of-range
  handling, and unmapped coil types.

## Scoring Rubric

Implemented in `src/eval-scorer.js`
(`scoreInterpreter`), executed by
`node src/run-evals.js` over the persisted run
artifacts.

- `requirementExtractionAccuracy`
  = matched expectedBusinessRules / total
  expectedBusinessRules (pooled across fixtures)
- `hvacTerminologyRecognition`
  = matched expectedHvacTerms / total
  expectedHvacTerms (pooled across fixtures)
- `ambiguityDetection`
  = matched expectedAmbiguities / total
  expectedAmbiguities (pooled across fixtures)

A criterion passes when its pooled score is greater
than or equal to its threshold.

## Measured Results

Generated by `node src/run-evals.js` into
`sub-agents-results.json` (per-fixture detail is
recorded there under `perFixture`).

| Criterion | Threshold | Baseline (run1, cids …765808/…656189/…695413) | Final (cids …512336/…526650/…543957/…553892) | Delta |
|-----------|-----------|-----------------|---------|-------|
| Requirement Extraction Accuracy | 90% | 0.900 | 0.933 | +0.033 |
| HVAC Terminology Recognition | 90% | 0.864 | 1.000 | +0.136 |
| Ambiguity Detection | 80% | 0.500 | 1.000 | +0.500 |

## Iteration Log

### Iteration 1 — Baseline

- Correlation IDs: HVAC-TICKET-1792007765808,
  HVAC-TICKET-1792007656189, HVAC-TICKET-1792007695413
  (tickets 1–3, committed at `4fcbf47` under
  `evidence/run1/`).
- Baseline scores: extraction 0.900, terminology
  0.864, ambiguity 0.500.
- Failure analysis: interpretations captured the
  business rules but omitted expected ambiguities
  (validation gaps, unit definitions, dynamic
  circuit behavior) and occasionally missed HVAC
  terms.

### Iteration 2 — Refinement

- Hypothesis: the prompt did not explicitly instruct
  ambiguity detection or isolate HVAC terminology,
  so underspecified areas were summarized away.
- Change: added explicit ambiguity-detection
  instructions and a dedicated HVAC terminology
  section to `agents/requirement-interpreter.md`
  (see `prompts/prompt-evolution.md`), plus strict
  JSON output requirements.
- Re-test: `evidence/run1` artifacts replaced by the
  current committed run; ambiguity detection rose
  from 0.50 to 1.00 on tickets 1–3.

### Iteration 3 — Re-dispatch Feedback

- Hypothesis: feeding reviewer findings back into a
  second interpretation pass would close remaining
  extraction gaps without inventing requirements.
- Change: `src/prompt-builder.js` injects
  `previousInterpretation` and `reviewerFindings`
  into the re-dispatched prompt.
- Re-test: measured on the current artifacts
  (`evidence/ticket1-run.json`…`ticket4-run.json`);
  extraction 0.933, terminology 1.000, ambiguity
  1.000. Within run HVAC-TICKET-1792016512336 the
  re-dispatched pass resolved the HIGH finding and
  reduced total findings from 5 to 3.

## Result Location

sub-agents-results.json
