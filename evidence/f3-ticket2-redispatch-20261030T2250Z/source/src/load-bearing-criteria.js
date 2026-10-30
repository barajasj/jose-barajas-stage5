const path = require('path');
const { validateSchema } = require('./schema-validator');
const {
  validateReview,
  validateInterpretationTransition
} = require('./governance-policy');

const schemas = {
  'requirement-interpreter': 'examiner.schema.json',
  'adversarial-reviewer': 'challenges.schema.json',
  'final-review-writer': 'final-review.schema.json'
};
const normalized = value => typeof value === 'string'
  ? value.trim().replace(/\s+/g, ' ').toLowerCase()
  : null;
const equalText = (a, b) => normalized(a) !== null && normalized(a) === normalized(b);
const equalValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function label(gold, key) {
  if (!Object.hasOwn(gold, key)) {
    throw Object.assign(new Error(`Missing gold label: ${key}`), { code: 'EVAL_CONFIGURATION_FAILURE' });
  }
  return gold[key];
}

function matchesText(actual, expected, equivalents = []) {
  return [expected, ...equivalents].some(value => equalText(actual, value));
}

function matchOneToOne(actual, expected, matches) {
  const actualToExpected = new Map();
  const assign = (expectedIndex, seen) => {
    for (let actualIndex = 0; actualIndex < actual.length; actualIndex++) {
      if (seen.has(actualIndex) || !matches(actual[actualIndex], expected[expectedIndex], expectedIndex)) {
        continue;
      }
      seen.add(actualIndex);
      const previous = actualToExpected.get(actualIndex);
      if (previous === undefined || assign(previous, seen)) {
        actualToExpected.set(actualIndex, expectedIndex);
        return true;
      }
    }
    return false;
  };
  for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex++) {
    assign(expectedIndex, new Set());
  }
  const expectedToActual = new Array(expected.length).fill(-1);
  for (const [actualIndex, expectedIndex] of actualToExpected) {
    expectedToActual[expectedIndex] = actualIndex;
  }
  return expectedToActual;
}

function sameStatements(actual, expected, equivalents = []) {
  if (!Array.isArray(actual) || !Array.isArray(expected)
    || actual.length !== expected.length
    || new Set(actual.map(normalized)).size !== actual.length) {
    return false;
  }
  return matchOneToOne(actual, expected, (value, item, index) =>
    matchesText(value, item, equivalents[index] || [])).every(index => index >= 0);
}

function containsStatements(actual, expected, equivalents = []) {
  if (!Array.isArray(expected) || expected.length === 0) {
    throw Object.assign(new Error('Missing applicable proposition labels.'), { code: 'EVAL_CONFIGURATION_FAILURE' });
  }
  if (!Array.isArray(actual)) {
    return false;
  }
  return matchOneToOne(actual, expected, (value, item, index) =>
    matchesText(value, item, equivalents[index] || [])).every(index => index >= 0);
}

function interpreterGrounded(output, gold) {
  const expected = label(gold, 'interpreter');
  const equivalents = gold.equivalents || {};
  return matchesText(output.requirementSummary, expected.requirementSummary,
    equivalents.requirementSummary)
    && ['hvacTerminology', 'businessRules', 'developerConsiderations', 'ambiguities']
      .every(field => sameStatements(output[field], expected[field], equivalents[field]));
}

function exactFinding(actual, expected) {
  const equivalents = expected.equivalents || {};
  const sameRefs = (actualRefs, expectedRefs) => Array.isArray(actualRefs)
    && Array.isArray(expectedRefs)
    && actualRefs.length === expectedRefs.length
    && expectedRefs.every(ref => actualRefs.some(value =>
      value.artifact === ref.artifact && value.pointer === ref.pointer && value.quote === ref.quote));
  const sameAmbiguities = (actualRefs, expectedRefs) => Array.isArray(actualRefs)
    && Array.isArray(expectedRefs)
    && actualRefs.length === expectedRefs.length
    && expectedRefs.every(ref => actualRefs.includes(ref));
  return actual.kind === expected.kind && actual.severity === expected.severity
    && matchesText(actual.description, expected.description, equivalents.description)
    && matchesText(actual.action, expected.action, equivalents.action)
    && sameRefs(actual.sourceRefs, expected.sourceRefs)
    && sameAmbiguities(actual.ambiguityRefs, expected.ambiguityRefs);
}

function detect(output, gold, categories) {
  const expected = label(gold, 'findings').filter(f => categories.includes(f.category));
  if (!expected.length) {
    throw Object.assign(new Error('Missing applicable finding labels.'), { code: 'EVAL_CONFIGURATION_FAILURE' });
  }
  const actual = Array.isArray(output.findings) ? output.findings : [];
  return matchFindings(actual, expected).every(index => index >= 0);
}

function matchFindings(actual, expected) {
  return matchOneToOne(actual, expected, exactFinding);
}

function groundedFindings(output, input, gold) {
  const expected = label(gold, 'findings');
  if (!Array.isArray(output.findings)
    || new Set(output.findings.map(f => f.id)).size !== output.findings.length) {
    return false;
  }
  const assignments = matchFindings(output.findings, expected);
  if (output.findings.length > expected.length
    || output.findings.some((_, index) => !assignments.includes(index))) {
    return false;
  }
  for (const finding of output.findings) {
    for (const ref of finding.sourceRefs) {
      let source = input.ticket;
      if (ref.artifact === 'interpreter') {
        source = ref.pointer.split('/').slice(1).reduce((value, key) =>
          value?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], input.interpreterResult);
      } else if (ref.artifact !== 'ticket' || ref.pointer !== '') {
        return false;
      }
      if (typeof source !== 'string' || !ref.quote.trim() || !source.includes(ref.quote)) {
        return false;
      }
    }
  }
  return true;
}

function parseReport(output) {
  const markdown = output.reportMarkdown.replace(/\r\n/g, '\n').trim();
  const sections = markdown.split(/^## (.+)\n/gm);
  const heading = /^# (PASS|FAIL)$/.exec(sections[0].trim());
  const names = [
    'Requirement Summary', 'Reviewer Findings', 'Open Ambiguities',
    'Final Disposition', 'Governance Reasons'
  ];
  if (!heading || sections.length !== 11
    || !names.every((name, i) => sections[i * 2 + 1] === name)) {
    throw new Error('Invalid report structure.');
  }
  const [summary, findings, ambiguities, disposition, reasons] =
    names.map((_, i) => sections[i * 2 + 2].trim());
  const jsonString = '("(?:\\\\.|[^"\\\\])*")';
  const row = new RegExp(
    `^- ([A-Za-z0-9][A-Za-z0-9_-]*) \\| (LOW|MEDIUM|HIGH) \\| ([A-Z_]+) \\| ${jsonString} \\| ${jsonString}$`
  );
  return {
    markdown,
    heading: heading[1],
    summary: JSON.parse(summary),
    findings: findings === 'None.' ? [] : findings.split('\n').map(line => {
      const match = row.exec(line);
      if (!match) {
        throw new Error('Invalid finding row.');
      }
      return {
        id: match[1], severity: match[2], kind: match[3],
        description: JSON.parse(match[4]), action: JSON.parse(match[5])
      };
    }),
    ambiguities: ambiguities === 'None.' ? [] : ambiguities.split('\n').map(line => {
      const match = new RegExp(`^- (/ambiguities/(?:0|[1-9]\\d*)) \\| ${jsonString}$`).exec(line);
      if (!match) {
        throw new Error('Invalid ambiguity row.');
      }
      return { pointer: match[1], text: JSON.parse(match[2]) };
    }),
    disposition,
    reasons: reasons.split('\n').map(line => {
      if (!/^- [A-Z_]+$/.test(line)) {
        throw new Error('Invalid governance reason.');
      }
      return line.slice(2);
    })
  };
}

function reportInterpreterGrounded(output, input) {
  const report = parseReport(output);
  return report.summary === input.interpreterResult.requirementSummary
    && equalValue(report.ambiguities, input.interpreterResult.ambiguities.map((text, i) =>
      ({ pointer: `/ambiguities/${i}`, text })));
}

function reportFindingsPreserved(output, input) {
  const actual = parseReport(output).findings;
  return new Set(actual.map(f => f.id)).size === actual.length
    && actual.every(f => input.reviewResult.findings.some(expected =>
      ['id', 'severity', 'kind', 'description', 'action'].every(key => f[key] === expected[key])));
}

function reportComplete(output, input) {
  const actual = parseReport(output).findings;
  return actual.length === input.reviewResult.findings.length
    && input.reviewResult.findings.every(f => actual.some(item => item.id === f.id));
}

function reportDisposition(output, input) {
  const actual = parseReport(output);
  return actual.heading === input.disposition && actual.disposition === input.disposition
    && equalValue(actual.reasons, input.reasonCodes);
}

const criteria = {
  rawResponseFormat: output => output !== null && typeof output === 'object' && !Array.isArray(output),
  schemaConformance: (output, input, gold, agent) =>
    validateSchema(output, path.join(__dirname, '../schemas', schemas[agent])).valid,
  summaryAccuracy: (output, input, gold) =>
    matchesText(output.requirementSummary, label(gold, 'interpreter').requirementSummary,
      gold.equivalents?.requirementSummary),
  hvacTerminologyAccuracy: (output, input, gold) =>
    sameStatements(output.hvacTerminology, label(gold, 'interpreter').hvacTerminology,
      gold.equivalents?.hvacTerminology),
  businessRuleAccuracy: (output, input, gold) =>
    sameStatements(output.businessRules, label(gold, 'interpreter').businessRules,
      gold.equivalents?.businessRules),
  validationRuleAccuracy: (output, input, gold) =>
    containsStatements(output.businessRules, label(gold, 'validationRules'),
      gold.equivalents?.validationRules),
  functionalBehaviorAccuracy: (output, input, gold) =>
    containsStatements(output.businessRules, label(gold, 'functionalRules'),
      gold.equivalents?.functionalRules),
  ambiguityAccuracy: (output, input, gold) =>
    sameStatements(output.ambiguities, label(gold, 'interpreter').ambiguities,
      gold.equivalents?.ambiguities),
  developerConsiderationGrounding: (output, input, gold) =>
    sameStatements(output.developerConsiderations, label(gold, 'interpreter').developerConsiderations,
      gold.equivalents?.developerConsiderations),
  confidencePolicyConsistency: (output, input, gold) => {
    const state = label(gold, 'readiness');
    const expected = { COMPLETE: 'HIGH', LOCAL_GAPS: 'MEDIUM', CORE_GAPS: 'LOW' }[state];
    if (!expected) {
      throw Object.assign(new Error('Invalid readiness label.'), { code: 'EVAL_CONFIGURATION_FAILURE' });
    }
    return output.confidence === expected
      && (expected !== 'HIGH' || output.ambiguities.length === 0);
  },
  sourceGrounding: (output, input, gold) => interpreterGrounded(output, gold),
  emptyArrayDiscipline: (output, input, gold) => {
    const expected = label(gold, 'interpreter');
    const fields = ['hvacTerminology', 'businessRules', 'developerConsiderations']
      .filter(field => expected[field].length === 0);
    if (!fields.length) {
      throw Object.assign(new Error('Missing empty-array labels.'), { code: 'EVAL_CONFIGURATION_FAILURE' });
    }
    return fields.every(field => Array.isArray(output[field]) && output[field].length === 0)
      && sameStatements(output.ambiguities, expected.ambiguities, gold.equivalents?.ambiguities);
  },
  redispatchSafety: (output, input, gold) => {
    validateInterpretationTransition(output, input);
    return interpreterGrounded(output, gold)
      && equalValue(output.ambiguityResolutions || [], label(gold, 'interpreter').ambiguityResolutions || []);
  },
  unsupportedAssumptionDetection: (output, input, gold) => detect(output, gold, ['UNSUPPORTED_ASSUMPTION']),
  missingRequirementDetection: (output, input, gold) => detect(output, gold, ['MISSING_REQUIREMENT']),
  hvacInterpretationErrorDetection: (output, input, gold) => detect(output, gold, ['HVAC_ERROR']),
  missingValidationDetection: (output, input, gold) => detect(output, gold, ['MISSING_VALIDATION']),
  reviewerAmbiguityCoverage: (output, input, gold) => {
    const detected = detect(output, gold, ['MISSED_AMBIGUITY', 'OPEN_AMBIGUITY']);
    return detected && input.interpreterResult.ambiguities.every((text, i) =>
      output.findings.some(f => f.kind === 'OPEN_AMBIGUITY'
        && f.ambiguityRefs.includes(`/ambiguities/${i}`)
        && f.sourceRefs.some(ref => ref.artifact === 'interpreter'
          && ref.pointer === `/ambiguities/${i}` && ref.quote === text)));
  },
  boundaryChallengeCoverage: (output, input, gold) =>
    detect(output, gold, ['BOUNDARY', 'CONFIGURATION', 'ROUNDING_TIE', 'UNKNOWN_CONFIGURATION', 'RANGE_INCREMENT']),
  ticketGrounding: groundedFindings,
  interpreterGrounding: groundedFindings,
  findingActionability: (output, input, gold) => {
    const expected = label(gold, 'findings');
    if (!expected.length) {
      throw Object.assign(new Error('Missing actionable finding labels.'), { code: 'EVAL_CONFIGURATION_FAILURE' });
    }
    return matchFindings(output.findings, expected).every(index => index >= 0);
  },
  severityAppropriateness: (output, input, gold) => {
    const expected = label(gold, 'findings');
    if (!expected.length) {
      throw Object.assign(new Error('Missing severity labels.'), { code: 'EVAL_CONFIGURATION_FAILURE' });
    }
    return matchFindings(output.findings, expected).every(index => index >= 0);
  },
  statusConsistency: (output, input) =>
    ['PASS', 'FAIL'].includes(output.status)
    && output.status === (output.findings.length ? 'FAIL' : 'PASS')
    && (output.status !== 'PASS' || input.interpreterResult.ambiguities.length === 0),
  reviewRationaleQuality: (output, input, gold) =>
    matchesText(output.rationale, label(gold, 'rationale'), gold.rationaleEquivalents),
  concernContinuity: (output, input, gold) => {
    validateReview(output, input);
    return equalValue(output.resolutions, label(gold, 'resolutions'))
      && output.findings.every(f => label(gold, 'findings').some(item => f.id === item.id));
  },
  ambiguityResolutionVerification: (output, input, gold) =>
    detect(output, gold, ['UNSUPPORTED_RESOLUTION']) && groundedFindings(output, input, gold),
  writerInterpreterGrounding: reportInterpreterGrounded,
  findingPreservation: reportFindingsPreserved,
  reportCompleteness: reportComplete,
  dispositionFidelity: reportDisposition,
  conclusionGrounding: (output, input) =>
    reportInterpreterGrounded(output, input) && reportFindingsPreserved(output, input)
    && reportComplete(output, input) && reportDisposition(output, input),
  boundedMarkdownFidelity: (output, input) => {
    parseReport(output);
    return output.reportMarkdown.replace(/\r\n/g, '\n').trim()
      === input.reportTemplate.replace(/\r\n/g, '\n').trim();
  }
};

function evaluateCriterion(name, agent, input, raw, gold) {
  if (!Object.hasOwn(criteria, name) || !Object.hasOwn(schemas, agent)) {
    throw new Error(`Unknown criterion or agent: ${name}, ${agent}`);
  }
  try {
    const output = JSON.parse(raw);
    if (output === null || typeof output !== 'object') {
      return false;
    }
    return Boolean(criteria[name](output, input, gold, agent));
  } catch (error) {
    if (error.code === 'EVAL_CONFIGURATION_FAILURE') {
      throw error;
    }
    return false;
  }
}

module.exports = { evaluateCriterion, criteria, parseReport, matchFindings };
