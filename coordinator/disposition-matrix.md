# Coordinator Disposition Matrix

| Condition | Action |
|------------|------------|
| Interpreter schema invalid | STOP |
| Reviewer schema invalid | STOP |
| High severity findings | RE-DISPATCH |
| Medium findings only | CONTINUE |
| No findings | CONTINUE |
| Human gate required | PUNCH OUT |
| Final report generated | COMPLETE |