# Adversarial Reviewer

## Purpose

Review the Requirement Interpreter output and challenge assumptions.

## Inputs

- Original ticket
- Requirement Interpreter output

## Outputs

- Findings
- Unsupported Assumptions
- Missing Requirements
- Missed Ambiguities
- Severity Assessment

## Success Criteria

1. Detects unsupported conclusions.
2. Identifies overlooked requirements.
3. Challenges weak interpretations.
4. Produces actionable findings.

## Allowed Tools

- read_ticket
- read_interpreter_output

## Forbidden Tools

- write_file
- shell
- http

## Isolation Requirement

This workflow must execute in an isolated context separate from the producing agent.