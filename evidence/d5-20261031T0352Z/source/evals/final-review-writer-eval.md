# Final Review Writer Evaluation

## F6 Measured Prompt Changes

Protocol: `docs/F6-MEASUREMENT.md`; versions/hypotheses:
`evals/f6-iterations.js`; ledger: `prompts/prompt-evolution.md`.
Four fixed writer inputs were measured unchanged across v0->v1->v2:
the two direct controls plus the preserved ticket-4 and positive-control inputs.
The exact fidelity contract is unchanged; 12 real responses are preserved.

| Measurement | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |
|---|---:|---:|---:|---:|---:|
| Strict passes / runtime accepted | 3/4 | 3/4 | 4/4 | 0 pp | +25 pp |
| Finding preservation | 3/4 | 3/4 | 4/4 | 0 pp | +25 pp |
| Report completeness | 13/14 | 13/14 | 14/14 | 0 pp | +7.14 pp |
| Output quality | 14/16 | 14/16 | 16/16 | 0 pp | +12.5 pp |

v1's opaque-template/JSON-encoding instructions did not fix the ticket-4 nested
escaping failure. v2's added decoded-character audit returned an exact report
for that same input. Both earlier rejected raw responses remain in the
denominator and are discoverable; v2 is not evidence of repeat-run reliability.
This is fidelity improvement on fixed direct inputs, not a new workflow PASS,
F4 closure, or an automatically deployed prompt.

Exact escaping deviations and all raw/input/prompt/validated artifacts:
[runtime rejections](../evidence/f6-20261030/runtime-rejections.json),
[measured summary](../evidence/f6-20261030/MEASURED-SUMMARY.md),
[machine results](../evidence/f6-20261030/measured-results.json).

## Preserved Live Evidence - Deliverable 5

One authorized batch is retained at `evidence/d5-20261030T1940Z/`.
Both direct writer cases passed runtime and strict scoring. Ticket 1's workflow
writer also passed. Two other attempted workflow writers failed the exact content
contract: ticket 4 removed existing escape characters from source strings; the
positive control changed "or precision" to "and precision" in a finding and ambiguity.
These are genuine contract deviations, not evidence of missing workflow status fields.

Thus 3/5 attempted writer steps passed runtime; pooled preservation/completeness/
quality of 1.0 covers only two direct cases and one completed workflow. Failed
workflows remain failures and are not included as successful preservation.
See `diagnostics.json.writerFailures` for exact differing substrings.
No writer prompt changed; no prompt-evolution delta or repeat-run reliability is claimed.

## Current scorer - Deliverable 4

`src/eval-scorer.js` now parses bounded reports through the independent section/row parser in `src/load-bearing-criteria.js`. It measures exact per-finding ID, severity, kind, description, and action; duplicates, missing concerns, invented concerns, altered summaries/ambiguities, contradictory heading/body dispositions, and unsupported conclusions fail. The runtime report template is an additional non-compensable contract/drift check, not the sole semantic scorer.

Clean PASS has real assertions with denominator 1, never 0/0 success. No reviewer findings plus unresolved interpreter ambiguities is invalid upstream input. Incidental "below" is not LOW severity. An altered or invented finding cannot be preserved by sharing two words with a HIGH concern elsewhere.

Existing preservation/completeness minima remain 1.00 and output quality 0.95. Run `node src/run-evals.js --self-test` for authored controls and `npm test` for adversarial regressions. Real model evidence and CLI contracts are documented in `evals/requirement-interpreter-eval.md`. Historical scores below remain unrefreshed.

## Stage 3 load-bearing coverage — Deliverable 3

Local instruction coverage is **12/12 = 100%**: seven numbered instructions plus five input slots. The examiner's historical count was 6/8 = 75%; its eight substantive families now have explicit content checks, but the local denominator is different and does not claim parser equivalence.

The supplemental audit runs with `node src/run-load-bearing-audit.js` (`--json` for per-case evidence) and `node --test tests/load-bearing.test.js`. Definitions are linked from `evals/test-cases.json.loadBearingAudit`; the unit map is `evals/load-bearing-map.json`.

### Writer instruction map

| Current Unit | Named Criterion | Case / Rejected Violation |
|---|---|---|
| W01 interpreter summary | writerInterpreterGrounding | `writer-interpreter`: changed requirement summary rejected, not merely a missing “summary” word |
| W02 every reviewer concern | findingPreservation, reportCompleteness | `writer-preservation`, `writer-completeness`: changed severity/action, new finding, dropped or duplicate concern |
| W03 interpreter ambiguities | writerInterpreterGrounding | All exact interpreter pointers and question text retained; dropped question rejected |
| W04 authoritative disposition/reasons | dispositionFidelity | `writer-fail-disposition`, `writer-pass-disposition`: opposing heading/body or invented governance reason |
| W05 no new findings/conclusions | findingPreservation, conclusionGrounding | New finding, unsupported “no concerns” conclusion, or empty summary rejected |
| W06 substantive bounded report | boundedMarkdownFidelity, conclusionGrounding | Extra section or bare section labels rejected; only outer whitespace/CRLF differences permitted |
| W07 raw JSON/schema | rawResponseFormat, schemaConformance | `final-review-writer-raw/schema`: fences, surrounding prose, wrong type, extra field |
| W08 nested-escaping fragment | boundedMarkdownFidelity | `*-bounded-markdown`: decoded or normalized backslashes before inch marks rejected; reportMarkdown must equal the supplied template |
| W09 verbatim-wording fragment | findingPreservation, boundedMarkdownFidelity | `*-bounded-markdown`: changing "or" to "and" or any template wording rejected |
| Interpreter input slot | writerInterpreterGrounding | Content must equal the supplied summary and all open ambiguities |
| Reviewer input slot | findingPreservation, reportCompleteness | Content must preserve every supplied concern and add none |
| Disposition input slot | dispositionFidelity | Heading and body must both equal coordinator input |
| Reason-code input slot | dispositionFidelity | Exact supplied reason codes required |
| Bounded-Markdown input slot | boundedMarkdownFidelity | Rendered content must match supplied bounded Markdown |


Prompt headings (for example `## Ticket`) are labels for the input slot beneath them, not separate instructions. Each heading inherits the criteria of its slot in the maps above: ticket grounding, interpreter grounding, previous-review continuity, schema conformance, disposition fidelity, and bounded-Markdown fidelity.

### Examiner unit reconciliation and preferred treatment

| Original Unit(s) | Original Gap | Preferred Action Implemented |
|---|---|---|
| 1: Requirement Interpreter Output | Unmapped | **Test** actual summary AND open ambiguities against that input |
| 8: no unsupported conclusions | Unmapped | **Rewrite + test** bounded, extractive conclusions; reject arbitrary added clearance |
| 4: summarize findings | Presence-only summary regex | **Retain + strengthen** substantive interpreter summary plus complete concern presentation |
| 5: present reviewer concerns | Partial presence/completeness | **Test** each concern's identity, severity, kind, description, and action |
| 6: clear disposition | Partial presence regex | **Test** heading, body, and supplied governance reasons together |
| 2, 3, 7: reviewer input, coordinator input, no new findings | Existing partial mappings | **Retain + strengthen** exact content fidelity and no-invention controls |

`src/load-bearing-criteria.js` independently parses the five report sections, quoted source strings, finding rows, ambiguity references, and reasons. It does not call the production `reportTemplate()` or `validateReport()` to decide the content criteria. Authored fixtures include a genuinely clean PASS and a FAIL with open questions and LOW/MEDIUM/HIGH concerns.

The checks are field-specific: correct section labels cannot compensate for an empty or altered summary; a severity label elsewhere cannot preserve a finding; a correct H1 cannot compensate for a contradictory body. Complete supplied strings are compared, not two-word overlap.

Repeated JSON-format prose and duplicate example text were consolidated into W07. Interpreter input, no-new-conclusion restrictions, and substantive concern/disposition requirements were retained rather than removed.

These are authored criterion-sensitivity measurements, not live writer executions or a prompt-evolution delta. The legacy results/log below are preserved and have not been revalidated. Deliverable 4 repaired scoring/aggregation; current live evidence is reported separately above.

## Historical evaluation record — not refreshed by Deliverable 3

## Purpose

Evaluate synthesis quality.

## Evaluation Criteria

### Criterion 1
Finding Preservation

Definition:
Does not introduce new findings.

Success Threshold:
100%

---

### Criterion 2
Report Completeness

Definition:
Includes all findings provided by previous workflows.

Success Threshold:
100%

---

### Criterion 3
Output Quality

Definition:
Produces readable markdown report.

Success Threshold:
95%

---

## Source Ticket Fixtures

The writer receives prior workflow outputs, not tickets directly. These fixtures are upstream sources for those outputs:

- fixtures/hvac-ticket-1.md
- fixtures/hvac-ticket-2.md
- fixtures/hvac-ticket-3.md
- fixtures/hvac-ticket-4.md

## Test Artifacts

- Requirement Interpreter output
- Adversarial Review output
- Coordinator disposition

## Test Case Definitions

Defined in `evals/test-cases.json` under
`finalReviewWriter` for each fixture
(`mustContainDisposition`), and evaluated against
the persisted run artifacts
(`evidence/ticketN-run.json`):

- **Finding preservation input**: the
  `finalReviewResult.findings` array of the same
  run. Each finding-bearing line in
  `reportMarkdown` must share at least 2
  significant words (length ≥ 4, stop words
  removed) with some reviewer finding description.
- **Completeness input**: every reviewer finding is
  covered when its severity label appears in the
  report AND at least 2 significant words of its
  description appear.
- **Output quality input**: 5 structural checks —
  (1) H1 heading equals the coordinator
  disposition, (2) summary section, (3) findings
  section, (4) disposition section, (5)
  disposition value stated in the body.

## Scoring Rubric

Implemented in `src/eval-scorer.js`
(`scoreWriter`), executed by
`node src/run-evals.js`.

- `findingPreservation`
  = supported finding-bearing lines / total
  finding-bearing lines. A line is "supported" when
  it shares ≥ 2 significant words with a reviewer
  finding. When the reviewer reported no findings,
  the score is 1 if the report introduces no
  finding lines, else 0.
- `reportCompleteness`
  = covered reviewer findings / total reviewer
  findings (1.0 when zero findings and the report
  states the pass outcome).
- `outputQuality`
  = structural checks passed / 5.

## Measured Results

Generated by `node src/run-evals.js` into
`sub-agents-results.json` (per-fixture detail is
recorded there under `perFixture`).

| Criterion | Threshold | Baseline (run1, cids …765808/…656189/…695413) | Final (cids …512336/…526650/…543957/…553892) | Delta |
|-----------|-----------|-----------------|---------|-------|
| Finding Preservation | 100% | 0.800 | 1.000 | +0.200 |
| Report Completeness | 100% | 1.000 | 1.000 | +0.000 |
| Output Quality | 95% | 0.667 | 1.000 | +0.333 |

## Iteration Log

### Iteration 1 — Baseline

- Correlation IDs: HVAC-TICKET-1792007765808,
  HVAC-TICKET-1792007656189, HVAC-TICKET-1792007695413.
- Baseline scores: preservation 0.800, completeness
  1.000, outputQuality 0.667.
- Failure analysis: free-form markdown reports
  sometimes omitted the `# <DISPOSITION>` H1
  heading and varied in section structure, and one
  finding line could not be traced back to a
  reviewer finding description.

### Iteration 2 — Structured Output

- Hypothesis: constraining the writer to a JSON
  envelope and enforcing its "no new findings"
  restriction would eliminate drift.
- Change: `agents/final-review-writer.md` gained
  strict JSON output requirements with the
  `{ "reportMarkdown" }` structure and the
  schema-validation guardrail in
  `schemas/final-review.schema.json`.
- Re-test: preservation reached 1.000 across all
  fixtures; no unsupported finding lines detected.

### Iteration 3 — Deterministic Disposition Heading

- Hypothesis: the remaining outputQuality failures
  were caused by the model inconsistently rendering
  the top-level disposition heading.
- Change: coordinator-side
  `assembleDeterministicHeading()` in
  `src/coordinator.js` guarantees the report begins
  with `# <disposition>` regardless of model
  output.
- Re-test: outputQuality rose from 0.667 to 1.000
  (+0.333); all 5 structural checks pass on all
  four fixtures.

## Result Location

sub-agents-results.json
