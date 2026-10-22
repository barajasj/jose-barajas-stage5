# REJECT Decision Evidence

Two evidence sources demonstrate the REJECT path:

1. Live workflow run (below): the recorded REJECT
   decision in `human-decisions.jsonl` halted the
   workflow before final report generation.
2. Active gate test: scenario `S2-explicit-reject` in
   `src/test-punchout.js` asserts that a REJECT
   decision returns `REJECTED_BY_HUMAN` and that the
   `final-review-writer` is never dispatched. See
   `runs/punchout-test-results.json`.

## Live Run Output

HIGH severity finding detected. Re-dispatching...
{
  "correlationId": "HVAC-TICKET-1791910400569",
  "status": "REJECTED_BY_HUMAN"
}
