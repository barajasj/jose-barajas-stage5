const fs = require('fs');
const path = require('path');
const { contexts } = require('./load-bearing-cases');

const clone = value => JSON.parse(JSON.stringify(value));
const cases = clone(contexts);

// D3 controls test individual criteria. Full-step cases must also satisfy
// cross-artifact contracts, including coverage of every input ambiguity.
function completeReview(testCase) {
  const { input, gold } = testCase;
  input.interpreterResult.ambiguities.forEach((text, i) => {
    const pointer = `/ambiguities/${i}`;
    if (gold.findings.some(f => f.ambiguityRefs.includes(pointer))) return;
    gold.findings.push({
      id: `OPEN-${i}`, category: 'OPEN_AMBIGUITY', kind: 'OPEN_AMBIGUITY', severity: 'MEDIUM',
      description: text, action: 'Obtain clarification from the ticket owner.',
      sourceRefs: [{ artifact: 'interpreter', pointer, quote: text }], ambiguityRefs: [pointer]
    });
  });
  testCase.output = {
    status: gold.findings.length ? 'FAIL' : 'PASS', rationale: gold.rationale,
    findings: gold.findings.map(({ category, ...finding }) => finding), resolutions: clone(gold.resolutions)
  };
}

for (const testCase of cases) {
  delete testCase.input.reviewCycle;
  delete testCase.input.reportTemplate;
  if (testCase.agent === 'adversarial-reviewer') completeReview(testCase);
}

const condenserOutput = {
  requirementSummary: 'Show AC or EC condenser inputs by selection and record condenser and circuit configuration for ECS calculation.',
  hvacTerminology: ['Air Cooled', 'Evaporative Cooled', 'Condenser Type', 'AC', 'EC', 'ASHRAE',
    'Condenser Tube Material', 'Condenser Fin Material', 'Condenser Tube Size', 'Condenser Fin Type',
    'Bank ID#', 'EC Model', 'Wet Bulb Temperature', 'Condenser Passes', 'Roof Type', 'ECS'],
  businessRules: [
    'Selecting Condenser Type AC or EC displays the corresponding input fields.',
    'AC records Design Ambient in degrees F or C with a default of 95 degrees F and ASHRAE Summer Design.',
    'AC includes Default Condenser and High Amb. / Altit. Cond. checkboxes.',
    'AC Condenser Tube Material defaults to Copper and Condenser Fin Material defaults to Aluminum.',
    'AC Condenser Tube Size options are 3/8 and 3/8 with 1-inch spacing; Condenser Fin Type defaults to Corrugated.',
    'EC includes system Bank ID#, user Copies of this Bank, EC Model from the catalog, and Wet Bulb Temperature in degrees F or C.',
    'AC Condenser Passes options are AutoOdd, AutoEven, and integers 2 through 41 in increments of 1.',
    'AC Roof Type offers dark and light options with and without parapet/shrouding.',
    'Ambient design conditions and coil geometry are recorded for AC condensers.',
    'EC model and wet bulb temperature are recorded for EC condensers.',
    'Condenser and per-circuit cooling configuration are output ready for ECS calculation.'
  ],
  developerConsiderations: ['Display the input fields corresponding to the selected AC or EC condenser type.'],
  ambiguities: [
    'The exact Roof Type option list is unspecified.',
    'The EC Model catalog entries are unspecified.',
    'Numeric validation ranges are unspecified.',
    'Temperature conversion and unit selection behavior are unspecified.',
    'The detailed per-circuit configuration fields are unspecified.'
  ],
  confidence: 'MEDIUM'
};
cases.push({
  id: 'condenser', agent: 'requirement-interpreter',
  input: { ticket: fs.readFileSync(path.join(__dirname, '../fixtures/hvac-ticket-3.md'), 'utf8') },
  output: condenserOutput,
  gold: { interpreter: clone(condenserOutput), readiness: 'LOCAL_GAPS' },
  provenance: 'Authored complete-proposition ticket-3 labels; not historical model output.'
});

for (const [defectId, correctId] of [
  ['missing', 'dx'], ['assumption', 'filters'], ['hvac', 'condenser'], ['validation', 'coil']
]) {
  const source = cases.find(testCase => testCase.id === correctId);
  const corrected = {
    id: `${defectId}-corrected`, agent: 'adversarial-reviewer',
    input: { ticket: source.input.ticket, interpreterResult: clone(source.output) },
    gold: {
      findings: [], resolutions: [],
      rationale: 'The explicit behavior is captured; only the listed source questions remain unresolved.'
    },
    provenance: 'Corrected fixed counterpart: stale accusations of the original defect must fail.'
  };
  completeReview(corrected);
  cases.push(corrected);
}

module.exports = { cases };
