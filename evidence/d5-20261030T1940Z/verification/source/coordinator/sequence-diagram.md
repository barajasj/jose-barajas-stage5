# Sequence Diagram

Ticket
  |
  v

Coordinator
  |
  +----> Requirement Interpreter
  |
  <---- Examiner Output
  |
  +----> Schema Validation
  |
  +----> Adversarial Reviewer
  |
  <---- Review Output
  |
  +----> Schema Validation
  |
  +----> Governance Decision
          |
          +---- Critical Findings?
                    |
                    +---- YES --> Re-dispatch Interpreter
                    |
                    +---- NO
  |
  +----> Final Review Writer
  |
  <---- Final Report
  |
  +----> Persist Audit Trail
  |
  v

Final Result