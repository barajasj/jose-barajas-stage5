# Ticket 2 F3 Follow-Up

One prospective real-model Ticket 2 workflow after the ambiguity-resolution prompt fix. No F6 changes.

## Result

- Workflow: COMPLETED; disposition: FAIL.
- Failure reason: none.
- Fireworks calls: 3; tokens (prompt/completion/total): 6897/5898/12795.
- A completed workflow means validated report generation, not a PASS disposition.

## Completion Comparison

| Cohort | Before | After this attempt |
| --- | ---: | ---: |
| Original workflow batch | 1/5 (20.0%) | unchanged historical cohort |
| First two F3 batches, all attempts | 7/10 (70.0%) | 8/11 (72.7%) |
| Latest F3 batch plus Ticket 2 rerun | 4/5 (80.0%) | 5/6 (83.3%) |
| Ticket 2 attempts | 1/2 complete | 2/3 complete |

All attempts remain in the referenced F3 packages and this follow-up. Failed attempts count as failures; no prior workflow or evidence file was overwritten.

## Artifacts

- `ticket2-run.json`, `runs/`, `audit.jsonl`, and `receipts/`: workflow result and actual model inputs, prompts, raw outputs, validated outputs where produced, audit records, and usage.
- `workflow-completion.json`: per-batch, cumulative, latest-six, and Ticket 2 rates.
- `prior-f3.json`: prior manifests and workflow summaries; `preservation-check.json`: original and prior F3 seals unchanged.
- `source/` and `source-state.json`: executed source snapshot and working-tree provenance.
- `manifest.json` and `manifest-final.json`: collection and final inventory seals.

No completion claim implies PASS; disposition and any remaining blocker are reported separately.