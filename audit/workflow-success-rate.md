# Workflow Success Rate

Computed from `audit/audit-log.jsonl` by grouping
entries per `correlationId` (one workflow execution
per ID).

Reproduce (excludes punch-out test scenarios,
which carry `coordinator-human-gate` entries —
8 per suite execution):

```bash
node -e "const fs=require('fs');const l=fs.readFileSync('audit/audit-log.jsonl','utf8').split('\n').filter(Boolean).map(JSON.parse);const g={};for(const e of l){(g[e.correlationId]=g[e.correlationId]||[]).push(e)};const t=new Set(Object.entries(g).filter(([c,es])=>es.some(e=>e.agent==='coordinator-human-gate')).map(([c])=>c));let c=0,n=0;for(const[cid,es]of Object.entries(g)){if(t.has(cid))continue;n++;if(es.some(e=>e.agent==='final-review-writer'&&e.status==='SUCCESS'))c++}console.log(c+' of '+n)"
```

## End-to-End Success Rate

| Metric | Value |
|--------|-------|
| Workflow executions (non-test) | 27 |
| Completed end-to-end (final-review-writer SUCCESS) | 23 |
| Halted by guardrail (`JSON_PARSE_FAILURE`) | 1 |
| Halted by human gate (`PUNCH_OUT`, no decision) | 2 |
| Halted by human decision (`REJECTED_BY_HUMAN`) | 1 |
| **End-to-end completion rate** | **23/27 = 85.2%** |
| Completion excluding intentional human-gate halts | 23/24 = 95.8% |

Latest evaluation batch (fixtures 1–4):

| Metric | Value |
|--------|-------|
| Runs | 4 (cids …512336, …526650, …543957, …553892) |
| Completed | 4 |
| Success rate | 100% |

## Per-Step Success Rates

Compounding error across the 3-step pipeline:

| Step | Executions | SUCCESS | Rate |
|------|-----------|---------|------|
| requirement-interpreter | 39 | 39 | 100% |
| adversarial-reviewer | 39 | 38 | 97.4% |
| final-review-writer | 23 | 23 | 100% |

(Test-scenario agent entries are excluded; mock
executions in `src/test-punchout.js` are not
production workflow runs.)

The single adversarial-reviewer failure is
`HVAC-TICKET-1791999987142`
(`JSON_PARSE_FAILURE`), which motivated the strict
JSON prompt iteration documented in
`evals/adversarial-reviewer-eval.md` — zero parse
failures have occurred since.

## Punch-Out Gate Test Runs

Additional `correlationId` entries are the
controlled punch-out test scenarios from
executions of `src/test-punchout.js` — 8 per
suite execution (5 halted as designed, 3
completed after explicit human approval). They
are excluded from the workflow success rate
above and tracked separately in
`runs/punchout-test-results.json` (8/8 passed
per run).
