# Adversarial Reviewer Evaluation

## Stage 3 load-bearing coverage — Deliverable 3

The legacy metrics and iteration history below are preserved as historical records, not revalidated claims. The supplemental instruction audit is independently executable:

```
node src/run-load-bearing-audit.js
node src/run-load-bearing-audit.js --json
node --test tests/load-bearing.test.js
```

Local coverage is **19/19 = 100%**: sixteen explicit instruction units and three input slots, versus the examiner's historical 8/12. Different denominators are not a performance improvement claim. The exact examiner parser is unavailable; this is a conservative local preflight, not an official grading result.

The definitions are discoverable through `evals/test-cases.json.loadBearingAudit`. `evals/load-bearing-map.json` maps each unit to named functions in `src/load-bearing-criteria.js`; `evals/load-bearing-cases.js` supplies frozen ticket/interpreter pairs and their authored expected findings. Each criterion must accept valid output and reject its targeted violations before it counts as measured coverage.

### Reviewer instruction map

| Current Unit | Named Criterion | Case / Rejected Violation |
|---|---|---|
| R01 unsupported assumptions | unsupportedAssumptionDetection, ticketGrounding | `assumption-detection`: sample isActive data incorrectly promoted to policy |
| R02 explicit omissions | missingRequirementDetection, interpreterGrounding | `missing-detection`: edit-triggered recalculation omitted; clean-input false accusation rejected |
| R03 HVAC meaning | hvacInterpretationErrorDetection | `hvac-detection`: swapped AC/EC meanings must be challenged |
| R04 explicit validation | missingValidationDetection | `validation-detection`: absent 1.25-to-100-inch range |
| R05 missed ambiguities | reviewerAmbiguityCoverage | `missed-ambiguity-detection`: tie-breaking question absent from interpreter |
| R06 already-listed open ambiguities | reviewerAmbiguityCoverage, statusConsistency | `open-detection`, `open-status`: all four exact references required; zero-finding PASS rejected |
| R07 boundaries/options | boundaryChallengeCoverage, ticketGrounding | `boundary-detection`: ties, spacing detection, limits, unknown configuration, range/increment interaction; `boundary-grounding`: invented clamp policy rejected |
| R08 both source artifacts / false positives | ticketGrounding, interpreterGrounding | Supported and clean-control cases: real quotations do not excuse false accusations; invented quotes rejected |
| R09 finding structure/action | schemaConformance, findingActionability, reviewerAmbiguityCoverage | `actionability`: generic or invented action rejected; schema and exact references checked separately |
| R10 severity impact | severityAppropriateness, statusConsistency | `hvac-severity` HIGH, `validation-severity` MEDIUM, `minor-label-severity` LOW; all block PASS |
| R11 PASS iff empty, no open questions | statusConsistency | Clean, HIGH, MEDIUM, LOW, and open-question cases; cardinality mismatch or false clearance rejected |
| R12 supported rationale | reviewRationaleQuality | Clean and concern-bearing rationale cases reject generic approval and unsupported clearance |
| R13 prior finding continuity | concernContinuity | `retained-continuity`, `resolved-continuity`: renamed/dropped concern, absent or irrelevant resolution rejected |
| R14 verify removed questions | ambiguityResolutionVerification | `bad-resolution-detection`: a real range quotation does not resolve rounding ties |
| R15 raw JSON/schema | rawResponseFormat, schemaConformance | `adversarial-reviewer-raw/schema`: fences, prose, wrong root/type, or extra field |
| R16 complete finding example | schemaConformance, findingActionability | Field omission rejected by schema (observed live: audit `HVAC-TICKET-1793313465729-*` missing `action`); generic or invented action rejected by `actionability` |
| Ticket input slot | ticketGrounding | Assertions tied to the fixed ticket, not expected accusation keywords alone |
| Interpreter input slot | interpreterGrounding, reviewerAmbiguityCoverage | Actual clean/defective output determines expected challenges |
| Previous-review input slot | concernContinuity | Remaining IDs preserved; each correction is explicitly supported |

### Examiner unit reconciliation and preferred treatment

| Original Unit(s) | Original Gap | Preferred Action Implemented |
|---|---|---|
| 3: incorrect HVAC interpretations | Unmapped | **Test** frozen reversed-definition output against the original AC/EC ticket |
| 5: missed ambiguities | Interpreter-only coverage | **Rewrite + test** missed questions separately from already-identified open questions |
| 6: grounding in Ticket | Unmapped | **Test** supported findings, true source quotations, false policy inference, and clean false-positive controls |
| 7: grounding in Interpreter Output | Unmapped | **Test** accusations against the actual frozen output, including corrected/clean cases |
| 1, 2, 4: assumptions, omissions, validation | Partial ticket-specific keywords | **Retain + strengthen** full finding propositions on fixed inputs |
| 8, 9: PASS/FAIL cardinality | Eval-only Boolean consistency | **Retain + test** both cardinalities and schema-valid PASS/empty with open questions |
| 10, 11, 12: LOW/MEDIUM/HIGH | Enum membership only | **Rewrite + test** impact-specific severity classes, including a LOW-only concern |

Removed prose: “Be skeptical” and “Assume the interpreter may be wrong.” These unobservable exhortations are replaced by R01–R08's concrete detection/grounding duties. Repeated JSON directives and contradictory/redundant examples were consolidated into R09/R11/R15. No substantive review responsibility was pruned to reduce the denominator.

R16 was added after a live real-mode run (`HVAC-TICKET-1793313465729-3ff8ae74-b994-455a-8023-234fc290f717`, audit `details`: `missingProperty: action`) produced a substantively correct five-finding review that omitted the required `action` field on every finding and was correctly rejected as SCHEMA_FAILURE. The prompt is the model's only contract — the agent has no tools and cannot read the schema file — so R16 supplies a valid complete-finding example rather than relying on field names alone.

The suite validates criterion sensitivity, not the model's detection rate. Schema-valid missing-finding controls change status consistently, so detection cannot pass merely by noticing an invalid JSON contract. Grounding labels require supported full descriptions/actions and exact sources; quotation existence alone is insufficient. Clean controls explicitly penalize invented accusations.

**Still deferred:** repairs to `src/eval-scorer.js` and `src/run-evals.js`, the historical 0.727 metric, baseline provenance, live re-runs, and genuine measured prompt-evolution iterations. This audit does not relabel those as resolved.

## Historical evaluation record — not refreshed by Deliverable 3

## Purpose

Evaluate review quality.

## Evaluation Criteria

### Criterion 1
Unsupported Assumption Detection

Definition:
Detects assumptions not supported by source requirements.

Success Threshold:
85%

---

### Criterion 2
Missing Requirement Detection

Definition:
Detects omitted business requirements.

Success Threshold:
85%

---

### Criterion 3
Challenge Quality

Definition:
Produces actionable findings.

Success Threshold:
90%

---

## Test Artifacts

- fixtures/hvac-ticket-1.md
- fixtures/hvac-ticket-2.md
- fixtures/hvac-ticket-3.md
- fixtures/hvac-ticket-4.md

## Test Case Definitions

Defined in `evals/test-cases.json` under
`adversarialReviewer` for each fixture:

- `expectedUnsupportedAssumptions`: challenges the
  reviewer should raise about claims the ticket
  does not support (matched against the
  concatenated `findings[].description` text).
- `expectedMissingRequirements`: challenges about
  requirements the interpreter omitted.

Each expected item carries an `id`, a human-readable
`expectation`, and an `anyOf` keyword list. An item
is scored 1 when ANY keyword appears as a
case-insensitive substring in the findings text,
else 0.

Examples:

- hvac-ticket-2: expects the reviewer to flag the
  interpreter's assumption that Condenser Type
  participates in the `parent` filter data, and to
  flag missing empty-result UI behavior and
  `isActive` handling.
- hvac-ticket-4: expects challenges on tie-breaking
  at half increments, 1"-spacing detection, and
  out-of-range input behavior. The measured run
  reported PASS with zero findings, so these
  expected challenges were not detected in this
  fixture — an honest scored miss.

## Scoring Rubric

Implemented in `src/eval-scorer.js`
(`scoreReviewer`), executed by
`node src/run-evals.js` over the persisted run
artifacts.

- `unsupportedAssumptionDetection`
  = matched expectedUnsupportedAssumptions / total
  (pooled across fixtures)
- `missingRequirementDetection`
  = matched expectedMissingRequirements / total
  (pooled across fixtures)
- `challengeQuality`
  = (findings with a valid severity
    LOW/MEDIUM/HIGH AND a description of at least
    40 characters + status consistent with findings)
    / (total findings + 1)
  where status consistency means `status === "PASS"`
  iff the findings array is empty.

## Measured Results

Generated by `node src/run-evals.js` into
`sub-agents-results.json` (per-fixture detail is
recorded there under `perFixture`).

| Criterion | Threshold | Baseline (run1, cids …765808/…656189/…695413) | Final (cids …512336/…526650/…543957/…553892) | Delta |
|-----------|-----------|-----------------|---------|-------|
| Unsupported Assumption Detection | 85% | 1.000 | 1.000 | +0.000 |
| Missing Requirement Detection | 85% | 0.250 | 0.727 | +0.477 |
| Challenge Quality | 90% | 1.000 | 1.000 | +0.000 |

Known gap: Missing Requirement Detection (0.727) is
below the 85% threshold, driven by the ticket-4 PASS
verdict that surfaced none of the expected
challenges. This is documented as the next
iteration's target (below).

## Iteration Log

### Iteration 1 — Structured Output Failure

- Evidence: audit entry
  `HVAC-TICKET-1791999987142` /
  `adversarial-reviewer` with status
  `JSON_PARSE_FAILURE` in `audit/audit-log.jsonl`;
  raw output persisted at
  `runs/HVAC-TICKET-1791999987142-adversarial-reviewer-raw.txt`
  (markdown table, not parseable JSON).
- Baseline: structured-output success rate 0% on
  that run; workflow halted at the guardrail.
- Hypothesis: the prompt did not constrain the
  output format, so the model produced a markdown
  challenges report instead of JSON.
- Change: strict JSON output requirements and the
  exact `{ "status", "findings" }` structure added
  to `agents/adversarial-reviewer.md`.

### Iteration 2 — Format Compliance

- Re-test: every subsequent reviewer execution in
  `audit/audit-log.jsonl` parsed and schema-validated
  successfully (52 consecutive SUCCESS entries, zero
  parse failures after the fix).
- Measured: challengeQuality 1.000 on both baseline
  and final runs — all findings carry valid
  severities and actionable descriptions.

### Iteration 3 — Re-Review Pass

- Hypothesis: a second review pass over the
  re-dispatched interpreter output would surface
  missing-requirement challenges the first pass
  under-reported (baseline detection 0.250).
- Change: coordinator re-dispatch loop plus the
  `-pass1.json` artifact snapshots in
  `src/artifact-writer.js`, giving a measurable
  pass-1 vs pass-2 comparison.
- Re-test: missingRequirementDetection rose from
  0.250 to 0.727 (+0.477). On ticket 1 the second
  pass resolved the HIGH finding while preserving
  the MEDIUM/LOW challenges.
- Remaining gap: ticket 4 reviewer returned PASS
  with no findings, missing the expected
  tie-break/spacing/out-of-range challenges. Next
  iteration hypothesis: add explicit instructions
  to challenge boundary-value and option-detection
  behavior in validation-focused tickets.

## Result Location

sub-agents-results.json
