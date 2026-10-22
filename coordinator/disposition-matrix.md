# Coordinator Disposition Matrix

| Condition | Action |
|------------|------------|
| Interpreter schema invalid | STOP |
| Reviewer schema invalid | STOP |
| High severity findings | RE-DISPATCH |
| Medium findings only | CONTINUE |
| No findings | CONTINUE |
| Human gate required, no decision recorded | PUNCH OUT |
| Human decision unrecognized or missing reason | PUNCH OUT (fail closed) |
| Human decision expired (timeout) | PUNCH OUT (fail closed) |
| Human decision REJECT | REJECTED_BY_HUMAN |
| Human decision APPROVE or CONTINUE | HUMAN_APPROVED_CONTINUE -> dispatch writer |
| Final report generated | COMPLETE / COMPLETED_AFTER_HUMAN_APPROVAL |