const { reportTemplate } = require('./report-contract');

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

  'adversarial-reviewer': input => ({
    status: 'FAIL',
    rationale: 'Mock review deliberately retains a concern to exercise fail-closed routing.',
    findings: [
      {
        id: 'MOCK-F1',
        severity: 'HIGH',
        kind: 'MISSING_REQUIREMENT',
        description:
          'Mock concern retained for runtime routing tests, not a real HVAC assessment.',
        action: 'Inspect this mock concern; do not treat mock execution as certification evidence.',
        sourceRefs: [{
          artifact: 'interpreter',
          pointer: '/requirementSummary',
          quote: input.interpreterResult.requirementSummary
        }],
        ambiguityRefs: []
      }
    ],
    resolutions: []
  }),

  'final-review-writer': input => ({
    reportMarkdown: reportTemplate(input)
  })
};