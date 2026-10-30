# Coordinator Disposition Matrix

| Condition | Action |
|------------|------------|
| Interpreter/reviewer JSON, schema, source, or governance invalid | STOP with structured non-PASS failure |
| Actionable HIGH interpretation finding, cycles remaining | RE-DISPATCH within maxReviewCycles; preserve unresolved concerns |
| HIGH finding at cycle limit | Stop retries; report FAIL |
| Open ambiguity at any severity | FAIL; require exact reviewer coverage; no futile retry for missing ticket facts |
| MEDIUM/LOW findings only | Continue to report, disposition FAIL |
| No findings and no open ambiguities | PASS eligible after all contracts and human gate |
| Dropped prior ambiguity/finding without sourced resolution | STOP with governance failure |
| Human gate required, no decision recorded | PUNCH OUT |
| Human decision unrecognized or missing reason | PUNCH OUT (fail closed) |
| Human decision expired (timeout) | PUNCH OUT (fail closed) |
| Human decision REJECT | REJECTED_BY_HUMAN |
| Human decision APPROVE or CONTINUE | HUMAN_APPROVED_CONTINUE -> dispatch writer; never clear findings/ambiguities |
| Writer changes supplied report content or disposition | GOVERNANCE_FAILURE; no validated report or SUCCESS |
| Final report validated | COMPLETED / COMPLETED_AFTER_HUMAN_APPROVAL; disposition remains derived PASS/FAIL |

Current measured evidence: `evidence/d5-20261030T1940Z/`. One of five workflows
completed, with FAIL; four failed closed. Completed status is not a PASS verdict.