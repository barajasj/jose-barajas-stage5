module.exports = {
  'requirement-interpreter': {
    requirementSummary:
      'DX Coil Height is calculated as the sum of all Cooling Circuit Heights.',
    hvacTerminology: [
      'DX Coil',
      'Cooling Circuit'
    ],
    businessRules: [
      'DX Coil Height equals the sum of all Cooling Circuit Heights.'
    ],
    developerConsiderations: [
      'Implement automatic recalculation.'
    ],
    ambiguities: [],
    confidence: 'HIGH'
  },

  'adversarial-reviewer': {
    status: 'FAIL',
    findings: [
      {
        severity: 'HIGH',
        description:
          'Behavior when no cooling circuits exist is undefined.'
      }
    ]
  },

'final-review-writer': {
  reportMarkdown: `
# FAIL

## Summary

Critical findings remain unresolved.

## Reviewer Findings

- Behavior when no cooling circuits exist is undefined.

## Final Disposition

FAIL
`
}
};