const fs = require('fs');
const path = require('path');

const clone = value => JSON.parse(JSON.stringify(value));
const fixture = number => fs.readFileSync(
  path.join(__dirname, `../fixtures/hvac-ticket-${number}.md`), 'utf8'
);
const io = (summary, terms, rules, considerations, ambiguities, confidence) => ({
  requirementSummary: summary, hvacTerminology: terms, businessRules: rules,
  developerConsiderations: considerations, ambiguities, confidence
});
const ref = (artifact, pointer, quote) => ({ artifact, pointer, quote });
const finding = (id, category, kind, severity, description, action, sourceRefs, ambiguityRefs = []) => ({
  id, category, kind, severity, description, action, sourceRefs, ambiguityRefs
});
const reviewOutput = (findings, rationale, resolutions = []) => ({
  status: findings.length ? 'FAIL' : 'PASS', rationale,
  findings: findings.map(({ category, ...value }) => clone(value)), resolutions
});
const contexts = [];

function interpreterCase(id, ticket, output, readiness, extra = {}) {
  const context = {
    id, agent: 'requirement-interpreter', input: { ticket }, output: clone(output),
    gold: { interpreter: clone(output), readiness, ...extra },
    provenance: 'Authored full-proposition gold; not a model response or legacy scorer result.'
  };
  contexts.push(context);
  return context;
}

function reviewerCase(id, ticket, interpreterResult, findings, rationale, extra = {}) {
  const resolutions = extra.resolutions || [];
  const context = {
    id, agent: 'adversarial-reviewer',
    input: { ticket, interpreterResult: clone(interpreterResult), ...extra.input },
    output: reviewOutput(findings, rationale, resolutions),
    gold: { findings: clone(findings), rationale, resolutions: clone(resolutions) },
    provenance: 'Frozen ticket/interpreter pair with authored supported findings and clean controls.'
  };
  contexts.push(context);
  return context;
}

const dxRules = [
  'Entering a Cooling Package runs calculations and populates Cooling Circuits.',
  'DX Coil Height is the sum of all populated Cooling Circuit heights.',
  'Editing any Circuit Height recalculates the sum and updates DX Coil Information.'
];
const dx = interpreterCase('dx', fixture(1), io(
  'Populate Cooling Circuits for a Cooling Package, sum their heights into DX Coil Height, and update the total when a Circuit Height is edited.',
  ['DX Coil', 'Cooling Package', 'Cooling Circuits', 'Circuit Height', 'DX Coil Information', 'R-454B'],
  dxRules,
  ['Update DX Coil Information when a Circuit Height is edited.'],
  [
    'Height units are unspecified.',
    'Valid height ranges and precision are unspecified.',
    'The source and format of starting circuit values are unspecified.',
    'Behavior when circuits are added or removed is unspecified.'
  ], 'MEDIUM'
), 'LOCAL_GAPS', { functionalRules: dxRules });
dx.sourceQuotes = [
  'Then we sum the height for each Circuit to make the value that is to appear in the DX Coil Information.',
  'should the user alter the Circuit Height'
];

const coilRules = [
  'Coil Height must be within 1.25 to 100 inches.',
  'Coil Height must be a multiple of its coil-specific increment.',
  'Non-multiple inputs are rounded to the nearest valid increment.',
  'The 3/8-inch or 1/2-inch tube increment is 1.25 inches.',
  'The 5/8-inch tube increment is 1.50 inches.',
  'The 1-inch tube increment is 2.25 inches.',
  'The Lamiflo coil increment is 9.00 inches.',
  'The 3/8-inch tube with 1-inch spacing increment is 1.00 inch instead of the generic increment.'
];
const coil = interpreterCase('coil', fixture(4), io(
  'Validate Water/Steam Coil Height within 1.25 to 100 inches and round to the nearest valid coil-specific increment.',
  ['Coil Height', 'Water/Steam', 'tube', 'Lamiflo', 'increment'],
  coilRules,
  ['Use the specified coil/configuration increments and preserve the special spacing override.'],
  [
    'Exact rounding tie-breaking is unspecified.',
    'The source of the 1-inch spacing configuration is unspecified.',
    'The response to out-of-range input is unspecified.',
    'Behavior for an unlisted coil configuration is unspecified.'
  ], 'MEDIUM'
), 'LOCAL_GAPS', { validationRules: coilRules });
coil.sourceQuotes = [
  'Valid range: 1.25" to 100"',
  '3/8" tube with 1" spacing: Increment = 1.00"',
  'Lamiflo coil: Increment = 9.00"'
];

const filterRules = [
  'Selecting Condenser Type and Refrigerant filters Unit Type by both selections.',
  'Selecting Unit Type filters Unit Size by Refrigerant and Unit Type.'
];
const filters = interpreterCase('filters', fixture(2), io(
  'Populate Unit Type from Condenser Type and Refrigerant, then populate Unit Size from Refrigerant and Unit Type.',
  ['Condenser Type', 'Refrigerant', 'Unit Type', 'Unit Size'],
  filterRules,
  ['Retrieve dropdown data from unitdesign GET /dropdowns.',
    'Use SDCommonUnitModelSizes parent entries containing the selected Refrigerant and Unit Type.'],
  [
    'The Condenser Type mapping is unclear because the example parent data contains refrigerants.',
    'Empty filter-result behavior is unspecified.',
    'Case sensitivity and downstream selection reset behavior are unspecified.'
  ], 'MEDIUM'
), 'LOCAL_GAPS', { functionalRules: filterRules });
filters.sourceQuotes = ['unitdesign api GET /dropdowns', 'the "parent" that contains both the refrigerant and the Unit Type selected'];

const cleanTicket = 'DX Coil Height equals the sum of Cooling Circuit Heights in inches. Recalculate immediately after a height edit. An empty circuit list produces 0 inches. Inputs are already validated; no other behavior is in scope.';
const clean = interpreterCase('clean', cleanTicket, io(
  'Sum Cooling Circuit Heights in inches into DX Coil Height, recalculate on edit, and use 0 inches for an empty list.',
  ['DX Coil Height', 'Cooling Circuit Heights'],
  [
    'DX Coil Height equals the sum of Cooling Circuit Heights in inches.',
    'A height edit immediately recalculates DX Coil Height.',
    'An empty circuit list produces 0 inches.',
    'Inputs are already validated.'
  ], [], [], 'HIGH'
), 'COMPLETE');

const sparse = interpreterCase('sparse',
  'A UI request is planned; the required behavior and fields are not specified.',
  io('The ticket does not yet define the requested UI behavior.', [], [], [],
    ['The requested behavior and affected fields are unspecified.'], 'LOW'),
  'CORE_GAPS');

const conflict = interpreterCase('conflict',
  'DX Coil Height must update immediately after every edit. DX Coil Height must never update after an edit.',
  io('The ticket gives conflicting update requirements for DX Coil Height.', ['DX Coil Height'],
    ['DX Coil Height must update immediately after every edit.',
      'DX Coil Height must never update after an edit.'], [],
    ['The ticket contradicts itself about updates after an edit.'], 'LOW'),
  'CORE_GAPS');

const redispatch = interpreterCase('redispatch', dx.input.ticket, dx.output, 'LOCAL_GAPS');
redispatch.input.previousInterpretation = {
  ...clone(dx.output),
  businessRules: dxRules.slice(0, 2),
  ambiguities: [...dx.output.ambiguities, 'How are circuit heights combined?']
};
redispatch.input.reviewerFindings = [{
  id: 'DX-F1', severity: 'HIGH', description: 'Restore recalculation after Circuit Height edits.'
}];
redispatch.input.reviewCycle = 2;
redispatch.output.ambiguityResolutions = [{
  ambiguity: 'How are circuit heights combined?',
  rationale: 'The original ticket explicitly states that the circuit heights are summed.',
  sourceQuote: dx.sourceQuotes[0]
}];
redispatch.gold.interpreter = clone(redispatch.output);

const assumption = reviewerCase('assumption', filters.input.ticket, {
  ...clone(filters.output),
  businessRules: [...filterRules, 'Always exclude entries with isActive=false.']
}, [finding(
  'A1', 'UNSUPPORTED_ASSUMPTION', 'UNSUPPORTED_ASSUMPTION', 'MEDIUM',
  'The interpreter makes isActive filtering mandatory, but the ticket provides sample data rather than that policy.',
  'Ask whether inactive entries must be excluded; do not assume the policy.',
  [ref('interpreter', '/businessRules/2', 'Always exclude entries with isActive=false.'),
    ref('ticket', '', '"isActive": true')]
)], 'An inactive-option policy was inferred from sample data and requires clarification.');

const missing = reviewerCase('missing', dx.input.ticket, {
  ...clone(dx.output), businessRules: dxRules.slice(0, 2), ambiguities: []
}, [finding(
  'DX-F1', 'MISSING_REQUIREMENT', 'MISSING_REQUIREMENT', 'HIGH',
  'The interpreter omits recalculation and updating DX Coil Information after Circuit Height edits.',
  'Restore the ticket requirement to recompute the sum and update DX Coil Information on edit.',
  [ref('ticket', '', 'should the user alter the Circuit Height')]
)], 'The stated edit-triggered recalculation is missing.');

const hvac = reviewerCase('hvac', fixture(3), io(
  'Configure AC and EC condensers.', ['AC', 'EC'],
  ['AC means Evaporative Cooled and EC means Air Cooled.'], [], [], 'HIGH'
), [finding(
  'H1', 'HVAC_ERROR', 'HVAC_ERROR', 'HIGH',
  'The interpreter swaps AC and EC meanings; the ticket defines Air Cooled as AC and Evaporative Cooled as EC.',
  'Restore Air Cooled (AC) and Evaporative Cooled (EC).',
  [ref('ticket', '', 'Air Cooled (AC) and Evaporative Cooled (EC)'),
    ref('interpreter', '/businessRules/0', 'AC means Evaporative Cooled and EC means Air Cooled.')]
)], 'The HVAC condenser meanings are reversed.');

const invalidRange = reviewerCase('validation', coil.input.ticket, {
  ...clone(coil.output), businessRules: coilRules.slice(1), ambiguities: []
}, [finding(
  'V1', 'MISSING_VALIDATION', 'MISSING_VALIDATION', 'MEDIUM',
  'The explicit 1.25-to-100-inch Coil Height range is absent from the interpretation.',
  'Restore both stated range limits and inches as the unit.',
  [ref('ticket', '', 'Valid range: 1.25" to 100"')]
)], 'The stated range limits and unit are missing.');

const missed = reviewerCase('missed-ambiguity', coil.input.ticket, {
  ...clone(coil.output), ambiguities: []
}, [finding(
  'Q1', 'MISSED_AMBIGUITY', 'MISSING_VALIDATION', 'MEDIUM',
  'The interpreter misses the unanswered rounding tie question; nearest rounding does not define ties.',
  'Ask the ticket owner how exact halfway values should be rounded.',
  [ref('ticket', '', 'round it to the nearest valid increment.')]
)], 'A missing tie-breaking policy was not surfaced as a question.');

const openFindings = coil.output.ambiguities.map((text, index) => finding(
  `O${index + 1}`, 'OPEN_AMBIGUITY', 'OPEN_AMBIGUITY',
  ['MEDIUM', 'LOW', 'MEDIUM', 'HIGH'][index],
  text, 'Obtain clarification from the ticket owner.',
  [ref('interpreter', `/ambiguities/${index}`, text)], [`/ambiguities/${index}`]
));
const open = reviewerCase('open', coil.input.ticket, coil.output, openFindings,
  'All four listed questions remain unresolved and prevent readiness clearance.');

const categories = ['ROUNDING_TIE', 'CONFIGURATION', 'BOUNDARY', 'UNKNOWN_CONFIGURATION'];
const boundaryFindings = openFindings.map((f, i) => ({ ...clone(f), category: categories[i] }));
boundaryFindings.push(finding(
  'B5', 'RANGE_INCREMENT', 'MISSING_VALIDATION', 'MEDIUM',
  'The ticket does not explain range handling when rounding to an increment would produce an out-of-range result.',
  'Clarify that the chosen rounded value must satisfy both the range and increment constraints without inventing clamp policy.',
  [ref('ticket', '', 'Valid range: 1.25" to 100"'),
    ref('ticket', '', 'round it to the nearest valid increment.')]
));
const boundary = reviewerCase('boundary', coil.input.ticket, coil.output, boundaryFindings,
  'Boundary, configuration, tie, unknown-option, and range/increment questions remain unresolved.');

const cleanReview = reviewerCase('clean-review', cleanTicket, clean.output, [],
  'The sum, inches, immediate edit update, empty-list result, and validated-input scope are captured without open questions.');

const low = reviewerCase('minor-label',
  'Display the calculated height using the exact label "DX Coil Height". The calculation is already correct.',
  io('Display the calculated height.', ['DX Coil Height'],
    ['Display the calculated height using the label "DX height".'], [], [], 'HIGH'),
  [finding(
    'L1', 'MISSING_REQUIREMENT', 'MISSING_REQUIREMENT', 'LOW',
    'The interpreter changes the explicitly requested display label from DX Coil Height to DX height.',
    'Keep the exact display label DX Coil Height without changing the already-correct calculation.',
    [ref('ticket', '', 'the exact label "DX Coil Height"'),
      ref('interpreter', '/businessRules/0', 'Display the calculated height using the label "DX height".')]
  )], 'The requested display label needs a minor wording correction.');

const retained = reviewerCase('retained', missing.input.ticket, missing.input.interpreterResult,
  missing.gold.findings, missing.output.rationale, { input: { previousReview: clone(missing.output) } });
const resolvedFindings = dx.output.ambiguities.map((text, index) => finding(
  `D${index + 1}`, 'OPEN_AMBIGUITY', 'OPEN_AMBIGUITY', 'MEDIUM', text,
  'Obtain clarification from the ticket owner.',
  [ref('interpreter', `/ambiguities/${index}`, text)], [`/ambiguities/${index}`]
));
const resolved = reviewerCase('resolved', dx.input.ticket, dx.output, resolvedFindings,
  'Edit-triggered recalculation is restored, but the remaining ticket questions still prevent clearance.', {
  input: { previousReview: clone(missing.output) },
  resolutions: [{
    findingId: 'DX-F1',
    rationale: 'The current business rule explicitly restores recalculation and the DX Coil Information update.',
    sourceRefs: [ref('interpreter', '/businessRules/2', dxRules[2])]
  }]
});

const badResolutionIO = clone(coil.output);
badResolutionIO.ambiguities = [];
badResolutionIO.ambiguityResolutions = [{
  ambiguity: coil.output.ambiguities[0],
  rationale: 'Assume the tie is resolved.',
  sourceQuote: 'Valid range: 1.25" to 100"'
}];
const badResolution = reviewerCase('bad-resolution', coil.input.ticket, badResolutionIO, [finding(
  'U1', 'UNSUPPORTED_RESOLUTION', 'UNSUPPORTED_ASSUMPTION', 'HIGH',
  'A range quotation does not answer the removed rounding tie question, so the claimed resolution is unsupported.',
  'Restore the tie-breaking question rather than inferring a resolution from range limits.',
  [ref('interpreter', '/ambiguityResolutions/0/sourceQuote', 'Valid range: 1.25" to 100"'),
    ref('ticket', '', 'round it to the nearest valid increment.')]
)], 'The interpreter removed a question using evidence that does not answer it.');

function writerCase(id, interpreterResult, reviewResult, disposition, reasonCodes) {
  const findings = reviewResult.findings.length ? reviewResult.findings.map(f =>
    `- ${f.id} | ${f.severity} | ${f.kind} | ${JSON.stringify(f.description)} | ${JSON.stringify(f.action)}`
  ).join('\n') : 'None.';
  const ambiguities = interpreterResult.ambiguities.length
    ? interpreterResult.ambiguities.map((text, i) => `- /ambiguities/${i} | ${JSON.stringify(text)}`).join('\n')
    : 'None.';
  const markdown = `# ${disposition}\n\n## Requirement Summary\n\n${JSON.stringify(interpreterResult.requirementSummary)}\n\n## Reviewer Findings\n\n${findings}\n\n## Open Ambiguities\n\n${ambiguities}\n\n## Final Disposition\n\n${disposition}\n\n## Governance Reasons\n\n${reasonCodes.map(code => `- ${code}`).join('\n')}`;
  const context = {
    id, agent: 'final-review-writer',
    input: { interpreterResult: clone(interpreterResult), reviewResult: clone(reviewResult),
      disposition, reasonCodes, reportTemplate: markdown },
    output: { reportMarkdown: markdown }, gold: {},
    provenance: 'Authored bounded report fixture; parsed independently of the production report renderer.'
  };
  contexts.push(context);
  return context;
}

const writerFail = writerCase('writer-fail', coil.output, open.output, 'FAIL',
  ['OPEN_FINDINGS', 'OPEN_AMBIGUITIES']);
const writerPass = writerCase('writer-pass', clean.output, cleanReview.output, 'PASS', ['NO_OPEN_CONCERNS']);

const mutation = (id, apply, schemaValid = true) => ({ id, apply, schemaValid });
const replace = (id, field, value, schemaValid = true) =>
  mutation(id, output => {
    output[field] = clone(value);
    if (field === 'findings') {
      output.status = value.length ? 'FAIL' : 'PASS';
    }
  }, schemaValid);
const rowChange = (id, field, index, value) =>
  mutation(id, output => { output[field][index] = clone(value); });
const reportChange = (id, transform) => mutation(id, output => {
  output.reportMarkdown = transform(output.reportMarkdown);
});
const checks = [];
const check = (id, criterion, context, negatives) => checks.push({
  id, criterion, context: context.id, negatives
});

for (const context of [dx, open, writerFail]) {
  check(`${context.agent}-raw`, 'rawResponseFormat', context, [
    { id: 'fenced-json', raw: `\`\`\`json\n${JSON.stringify(context.output)}\n\`\`\``, schemaValid: false },
    { id: 'surrounding-prose', raw: `Here is the output:\n${JSON.stringify(context.output)}`, schemaValid: false },
    { id: 'array-root', raw: '[]', schemaValid: false }
  ]);
  check(`${context.agent}-schema`, 'schemaConformance', context, [
    replace('extra-field', 'unexpected', true, false),
    ...Object.keys(context.output).map(field =>
      replace(`wrong-type-${field}`, field, 42, false))
  ]);
}

check('summary', 'summaryAccuracy', coil, [
  replace('wrong-range', 'requirementSummary', 'Validate Coil Height from 0 to 100 millimeters.'),
  replace('generic-summary', 'requirementSummary', 'Review the HVAC ticket.')
]);
check('terminology', 'hvacTerminologyAccuracy', coil, [
  replace('invented-term', 'hvacTerminology', [...coil.output.hvacTerminology, 'Compressor RPM']),
  replace('omitted-term', 'hvacTerminology', ['Coil Height'])
]);
check('business-rules', 'businessRuleAccuracy', dx, [
  rowChange('wrong-aggregation', 'businessRules', 1, 'DX Coil Height is the maximum Circuit Height.'),
  replace('omitted-edit-rule', 'businessRules', dxRules.slice(0, 2))
]);
check('validation', 'validationRuleAccuracy', coil, [
  ...coilRules.map((rule, i) => rowChange(
    `wrong-validation-proposition-${i + 1}`, 'businessRules', i, `${rule} This rule does not apply.`
  )),
  rowChange('wrong-upper-limit', 'businessRules', 0, 'Coil Height must be within 1.25 to 1000 inches.'),
  rowChange('wrong-units', 'businessRules', 0, 'Coil Height must be within 1.25 to 100 millimeters.'),
  rowChange('wrong-spacing-override', 'businessRules', 7, 'Use the generic 1.25-inch increment for every 3/8-inch configuration.')
]);
for (const context of [dx, filters]) {
  check(`${context.id}-functional`, 'functionalBehaviorAccuracy', context, [
    rowChange('wrong-trigger', 'businessRules', 0, 'Run only after an unrelated field changes.'),
    rowChange('wrong-dependent-output', 'businessRules', context === dx ? 2 : 1, 'Update a different output field.')
  ]);
}
check('ambiguities', 'ambiguityAccuracy', coil, [
  replace('erased-question', 'ambiguities', coil.output.ambiguities.slice(1)),
  replace('false-ambiguity', 'ambiguities', [...coil.output.ambiguities, 'The Lamiflo increment is unspecified.'])
]);
for (const context of [dx, filters]) {
  check(`${context.id}-developer`, 'developerConsiderationGrounding', context, [
    replace('invented-implementation-policy', 'developerConsiderations', ['Use event listeners and reset every downstream selection.']),
    replace('missing-supported-constraint', 'developerConsiderations', [])
  ]);
}
for (const context of [clean, dx, sparse, conflict]) {
  check(`${context.id}-confidence`, 'confidencePolicyConsistency', context, [
    replace('wrong-readiness-class', 'confidence', context.output.confidence === 'HIGH' ? 'LOW' : 'HIGH')
  ]);
}
for (const context of [coil, filters]) {
  check(`${context.id}-grounding`, 'sourceGrounding', context, [
    replace('invented-rule', 'businessRules', [...context.output.businessRules, 'Clamp invalid inputs and exclude inactive entries.']),
    replace('unrelated-ticket-summary', 'requirementSummary', sparse.output.requirementSummary)
  ]);
}
check('empty-arrays', 'emptyArrayDiscipline', sparse, [
  replace('invented-term', 'hvacTerminology', ['DX Coil']),
  replace('invented-rule', 'businessRules', ['The field must be positive.']),
  replace('invented-technical-policy', 'developerConsiderations', ['Persist values across sessions.']),
  replace('empty-questions', 'ambiguities', [])
]);
check('redispatch', 'redispatchSafety', redispatch, [
  replace('erased-unanswered-question', 'ambiguities', redispatch.output.ambiguities.slice(1)),
  replace('invented-fix', 'businessRules', [...dxRules, 'Reject all negative heights.']),
  mutation('irrelevant-resolution-quote', output => {
    output.ambiguityResolutions[0].sourceQuote = 'The DX Coil Height is empty.';
  })
]);

for (const [criterion, context] of [
  ['unsupportedAssumptionDetection', assumption],
  ['missingRequirementDetection', missing],
  ['hvacInterpretationErrorDetection', hvac],
  ['missingValidationDetection', invalidRange],
  ['reviewerAmbiguityCoverage', missed],
  ['reviewerAmbiguityCoverage', open],
  ['ambiguityResolutionVerification', badResolution]
]) {
  check(`${context.id}-detection`, criterion, context, [
    replace('missed-all-challenges', 'findings', []),
    mutation('unrelated-description', output => { output.findings[0].description = 'The output should be reviewed.'; })
  ]);
}
check('boundary-detection', 'boundaryChallengeCoverage', boundary,
  boundary.output.findings.map((_, i) => replace(
    `missed-boundary-class-${i + 1}`, 'findings', boundary.output.findings.filter((__, index) => index !== i)
  )));
for (const criterion of ['ticketGrounding', 'interpreterGrounding']) {
  check(`${criterion}-supported`, criterion, assumption, [
    mutation('false-accusation-with-real-quote', output => {
      output.findings[0].description = 'The ticket requires isActive filtering but the interpreter omits it.';
    }),
    mutation('fabricated-interpreter-citation', output => { output.findings[0].sourceRefs[0].quote = 'Invented evidence'; }),
    mutation('fabricated-ticket-citation', output => { output.findings[0].sourceRefs[1].quote = 'Invented evidence'; })
  ]);
  check(`${criterion}-clean-control`, criterion, cleanReview, [
    replace('false-positive-on-clean-input', 'findings', missing.output.findings)
  ]);
}
check('boundary-grounding', 'ticketGrounding', boundary, [
  mutation('invented-clamp-policy', output => {
    output.findings[4].action = 'Always clamp to 100 inches, regardless of increment constraints.';
  })
]);
check('actionability', 'findingActionability', invalidRange, [
  mutation('generic-action', output => { output.findings[0].action = 'Fix it.'; }),
  mutation('invented-action', output => { output.findings[0].action = 'Change the range to 0 to 1000 millimeters.'; })
]);
for (const context of [hvac, invalidRange, low]) {
  check(`${context.id}-severity`, 'severityAppropriateness', context, [
    mutation('misclassified-impact', output => {
      output.findings[0].severity = output.findings[0].severity === 'HIGH' ? 'LOW' : 'HIGH';
    })
  ]);
}
for (const context of [cleanReview, open, hvac, invalidRange, low]) {
  check(`${context.id}-status`, 'statusConsistency', context, [
    replace('opposite-status', 'status', context.output.status === 'PASS' ? 'FAIL' : 'PASS', false),
    ...(context === open ? [replace('zero-finding-clearance-with-open-ambiguities', 'findings', [])] : [])
  ]);
  check(`${context.id}-rationale`, 'reviewRationaleQuality', context, [
    replace('meaningless-rationale', 'rationale', 'Looks good.'),
    replace('unsupported-clearance', 'rationale', 'All requirements are satisfied; no concerns remain.')
  ]);
}
for (const context of [retained, resolved]) {
  check(`${context.id}-continuity`, 'concernContinuity', context, [
    context === retained
      ? mutation('renamed-unresolved-finding', output => { output.findings[0].id = 'NEW-ID'; })
      : replace('missing-resolution', 'resolutions', []),
    context === retained
      ? replace('dropped-unresolved-finding', 'findings', [])
      : mutation('unrelated-resolution', output => { output.resolutions[0].rationale = 'No explanation.'; })
  ]);
}

check('writer-interpreter', 'writerInterpreterGrounding', writerFail, [
  reportChange('wrong-summary', text => text.replace(JSON.stringify(coil.output.requirementSummary), '"Different requirement."')),
  reportChange('dropped-ambiguity', text => text.replace(
    `- /ambiguities/0 | ${JSON.stringify(coil.output.ambiguities[0])}\n`, ''
  ))
]);
check('writer-preservation', 'findingPreservation', writerFail, [
  reportChange('changed-severity', text => text.replace('| MEDIUM |', '| HIGH |')),
  reportChange('changed-action', text => text.replace('"Obtain clarification from the ticket owner."', '"Assume the answer."')),
  reportChange('new-finding', text => text.replace('## Open Ambiguities',
    '- NEW | HIGH | MISSING_REQUIREMENT | "Invented finding." | "Invented action."\n\n## Open Ambiguities'))
]);
check('writer-completeness', 'reportCompleteness', writerFail, [
  reportChange('dropped-concern', text => text.split('\n').filter(line => !line.startsWith('- O2 |')).join('\n')),
  reportChange('duplicate-concern', text => text.replace('- O2 |', '- O1 |'))
]);
for (const context of [writerFail, writerPass]) {
  check(`${context.id}-disposition`, 'dispositionFidelity', context, [
    reportChange('opposing-heading', text => text.replace(
      `# ${context.input.disposition}`, `# ${context.input.disposition === 'PASS' ? 'FAIL' : 'PASS'}`
    )),
    reportChange('opposing-body', text => text.replace(
      `## Final Disposition\n\n${context.input.disposition}`,
      `## Final Disposition\n\n${context.input.disposition === 'PASS' ? 'FAIL' : 'PASS'}`
    )),
    reportChange('invented-reason', text => text + '\n- ALL_REQUIREMENTS_SATISFIED')
  ]);
  check(`${context.id}-conclusions`, 'conclusionGrounding', context, [
    reportChange('unsupported-conclusion', text => text + '\nNo outstanding concerns remain.'),
    reportChange('empty-summary-section', text => text.replace(
      JSON.stringify(context.input.interpreterResult.requirementSummary), '""'
    ))
  ]);
  check(`${context.id}-bounded-markdown`, 'boundedMarkdownFidelity', context, [
    reportChange('extra-section', text => text + '\n\n## Conclusions\n\nAll requirements are satisfied.'),
    reportChange('empty-section-labels', () => `# ${context.input.disposition}\nSummary\nFindings\nDisposition`)
  ]);
}

module.exports = { contexts, checks };
