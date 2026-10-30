const path = require('path');
const { validateSchema } = require('./schema-validator');
const { evaluateCriterion, matchFindings, parseReport } = require('./load-bearing-criteria');
const { validateReview, validateInterpretationTransition } = require('./governance-policy');
const { reportTemplate } = require('./report-contract');

const VERSION = 'content-v3-reviewed-equivalents';
const SCHEMAS = {
  'requirement-interpreter': 'examiner.schema.json',
  'adversarial-reviewer': 'challenges.schema.json',
  'final-review-writer': 'final-review.schema.json'
};
const THRESHOLDS = {
  requirementExtractionAccuracy: 0.90, hvacTerminologyRecognition: 0.90, ambiguityDetection: 0.80,
  unsupportedAssumptionDetection: 0.85, missingRequirementDetection: 0.85, challengeQuality: 0.90,
  findingPreservation: 1, reportCompleteness: 1, outputQuality: 0.95,
  summaryAccuracy: 1, developerConsiderationGrounding: 1, confidencePolicyConsistency: 1,
  hvacInterpretationErrorDetection: 1, missingValidationDetection: 1, boundaryChallengeCoverage: 1
};
const normalized = text => typeof text === 'string' ? text.trim().replace(/\s+/g, ' ').toLowerCase() : null;
const sameText = (a, b, equivalents = []) => [b, ...equivalents].some(value =>
  normalized(a) !== null && normalized(a) === normalized(value));
const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nonblank = value => typeof value === 'string' && Boolean(value.trim());

function configured(condition, message) {
  if (!condition) throw Object.assign(new Error(message), { code: 'EVAL_CONFIGURATION_FAILURE' });
}

function validateTextVariants(value, message) {
  configured(Array.isArray(value) && value.every(item => nonblank(item)), message);
}

function validateInterpreterEquivalents(gold) {
  const equivalents = gold.equivalents || {};
  const fields = [
    'requirementSummary', 'hvacTerminology', 'businessRules',
    'developerConsiderations', 'ambiguities', 'validationRules', 'functionalRules'
  ];
  configured(Object.keys(equivalents).every(field => fields.includes(field)),
    'Unknown interpreter equivalence field.');
  for (const [field, variants] of Object.entries(equivalents)) {
    if (field === 'requirementSummary') {
      validateTextVariants(variants, 'Invalid summary equivalences.');
      continue;
    }
    const expected = field === 'validationRules' || field === 'functionalRules'
      ? gold[field] : gold.interpreter[field];
    configured(Array.isArray(expected) && Array.isArray(variants)
      && variants.length === expected.length,
    `Invalid equivalence count for ${field}.`);
    variants.forEach(items => validateTextVariants(items, `Invalid ${field} equivalence.`));
  }
}

function validateReviewerEquivalents(gold) {
  validateTextVariants(gold.rationaleEquivalents || [], 'Invalid rationale equivalences.');
  for (const finding of gold.findings) {
    const equivalents = finding.equivalents || {};
    configured(Object.keys(equivalents).every(field => ['description', 'action'].includes(field)),
      `Unknown finding equivalence field: ${finding.id}`);
    for (const variants of Object.values(equivalents)) {
      validateTextVariants(variants, `Invalid finding equivalences: ${finding.id}`);
    }
  }
}

function attempt(check) {
  try {
    return Boolean(check());
  } catch (error) {
    if (error.code === 'EVAL_CONFIGURATION_FAILURE') throw error;
    return false;
  }
}

function metric(checks, reason = 'No applicable source expectations in this fixed case.') {
  configured(Array.isArray(checks) && checks.every(check => typeof check === 'boolean'), 'Metric checks must be Boolean.');
  const matched = checks.filter(Boolean).length;
  return checks.length
    ? { applicable: true, matched, total: checks.length, score: matched / checks.length }
    : { applicable: false, matched: 0, total: 0, score: null, reason };
}

function statements(actual, expected, equivalents = []) {
  configured(Array.isArray(expected) && expected.every(nonblank), 'Missing mandatory proposition labels.');
  const matched = new Set();
  return metric(expected.map((item, index) => {
    if (!Array.isArray(actual)) return false;
    const candidate = actual.findIndex((value, candidateIndex) =>
      !matched.has(candidateIndex) && sameText(value, item, equivalents[index] || []));
    if (candidate < 0) return false;
    matched.add(candidate);
    return true;
  }));
}

function schemaValid(agent, output) {
  configured(Object.hasOwn(SCHEMAS, agent), `Unknown eval agent: ${agent}`);
  return validateSchema(output, path.join(__dirname, '../schemas', SCHEMAS[agent])).valid;
}

function parseCandidate(candidate) {
  try {
    const output = typeof candidate === 'string' ? JSON.parse(candidate) : candidate;
    return output !== null && typeof output === 'object' && !Array.isArray(output) ? output : null;
  } catch {
    return null;
  }
}

function validateLabels(agent, input, gold) {
  configured(input && typeof input === 'object' && gold && typeof gold === 'object', 'Missing eval context or gold.');
  if (agent !== 'final-review-writer') configured(nonblank(input.ticket), 'Missing fixed ticket input.');
  if (agent === 'requirement-interpreter') {
    configured(gold.interpreter && schemaValid(agent, gold.interpreter), 'Missing or invalid interpreter gold.');
    configured(['COMPLETE', 'LOCAL_GAPS', 'CORE_GAPS'].includes(gold.readiness), 'Missing readiness label.');
    validateInterpreterEquivalents(gold);
    configured(attempt(() => { validateInterpretationTransition(gold.interpreter, input); return true; }),
      'Invalid gold interpretation transition.');
  } else if (agent === 'adversarial-reviewer') {
    configured(schemaValid('requirement-interpreter', input.interpreterResult), 'Missing fixed interpreter input.');
    configured(Array.isArray(gold.findings) && nonblank(gold.rationale) && Array.isArray(gold.resolutions),
      'Missing mandatory contextual review labels.');
    validateReviewerEquivalents(gold);
    const reference = {
      status: gold.findings.length ? 'FAIL' : 'PASS', rationale: gold.rationale,
      findings: gold.findings.map(({ category, equivalents, ...finding }) => finding),
      resolutions: gold.resolutions
    };
    configured(schemaValid(agent, reference) && attempt(() => { validateReview(reference, input); return true; }),
      'Review gold must satisfy the runtime contract for its fixed input.');
    configured(gold.findings.every(finding => nonblank(finding.category)), 'Missing review category labels.');
  } else {
    configured(Object.hasOwn(SCHEMAS, agent), `Unknown eval agent: ${agent}`);
    configured(Object.keys(gold).length === 0, 'Writer fidelity uses supplied inputs, not output-derived gold.');
    configured(input.interpreterResult && input.reviewResult && Array.isArray(input.reviewResult.findings),
      'Missing writer upstream inputs.');
  }
}

function scoreStep(agent, candidate, input, gold) {
  validateLabels(agent, input, gold);
  const parsed = parseCandidate(candidate);
  const valid = parsed !== null && schemaValid(agent, parsed);
  const output = valid ? parsed : null;
  const raw = output ? JSON.stringify(output) : 'null';
  const check = name => evaluateCriterion(name, agent, input, raw, gold);
  const gates = {
    rawResponseFormat: parsed !== null,
    schemaConformance: valid
  };
  let metrics;
  if (agent === 'requirement-interpreter') {
    const expected = gold.interpreter;
    metrics = {
      requirementExtractionAccuracy: statements(output?.businessRules, expected.businessRules,
        gold.equivalents?.businessRules),
      hvacTerminologyRecognition: statements(output?.hvacTerminology, expected.hvacTerminology,
        gold.equivalents?.hvacTerminology),
      ambiguityDetection: statements(output?.ambiguities, expected.ambiguities,
        gold.equivalents?.ambiguities),
      summaryAccuracy: metric([check('summaryAccuracy')]),
      developerConsiderationGrounding: metric([check('developerConsiderationGrounding')]),
      confidencePolicyConsistency: metric([check('confidencePolicyConsistency')])
    };
    gates.sourceGrounding = check('sourceGrounding');
    gates.redispatchSafety = attempt(() => {
      validateInterpretationTransition(output, input);
      return sameValue(output.ambiguityResolutions || [], expected.ambiguityResolutions || []);
    });
  } else if (agent === 'adversarial-reviewer') {
    const detect = categories => {
      const expected = gold.findings.filter(f => categories.includes(f.category));
      return metric(matchFindings(output?.findings || [], expected).map(index => index >= 0));
    };
    const allExpectedFindingsMatched =
      matchFindings(output?.findings || [], gold.findings).every(index => index >= 0);
    metrics = {
      unsupportedAssumptionDetection: detect(['UNSUPPORTED_ASSUMPTION', 'UNSUPPORTED_RESOLUTION']),
      missingRequirementDetection: detect(['MISSING_REQUIREMENT']),
      hvacInterpretationErrorDetection: detect(['HVAC_ERROR']),
      missingValidationDetection: detect(['MISSING_VALIDATION']),
      ambiguityDetection: detect(['MISSED_AMBIGUITY', 'OPEN_AMBIGUITY']),
      boundaryChallengeCoverage: detect(['BOUNDARY', 'CONFIGURATION', 'ROUNDING_TIE', 'UNKNOWN_CONFIGURATION', 'RANGE_INCREMENT']),
      challengeQuality: metric([
        check('reviewRationaleQuality'),
        ...(gold.findings.length ? [allExpectedFindingsMatched] : [output?.findings?.length === 0])
      ])
    };
    gates.runtimeContract = attempt(() => { validateReview(output, input); return true; });
    gates.falsePositiveControl = check('ticketGrounding') && check('interpreterGrounding');
    gates.rationaleGrounding = check('reviewRationaleQuality');
    gates.concernContinuity = gates.runtimeContract && sameValue(output?.resolutions, gold.resolutions);
  } else {
    let report;
    gates.upstreamContract = attempt(() => {
      if (!schemaValid('requirement-interpreter', input.interpreterResult)
        || !schemaValid('adversarial-reviewer', input.reviewResult)) return false;
      reportTemplate(input);
      return input.interpreterResult.ambiguities.every((text, i) =>
        input.reviewResult.findings.some(f => f.kind === 'OPEN_AMBIGUITY'
          && f.ambiguityRefs.includes(`/ambiguities/${i}`)
          && f.sourceRefs.some(ref => ref.artifact === 'interpreter'
            && ref.pointer === `/ambiguities/${i}` && ref.quote === text)));
    });
    gates.reportStructure = attempt(() => { report = parseReport(output); return true; });
    const expected = input.reviewResult.findings;
    metrics = {
      findingPreservation: metric([Boolean(report) && check('findingPreservation')]),
      reportCompleteness: metric(expected.length ? expected.map(f =>
        Boolean(report) && report.findings.filter(row => row.id === f.id).length === 1
          && report.findings.some(row => ['id', 'severity', 'kind', 'description', 'action']
            .every(key => row[key] === f[key])))
        : [Boolean(report) && report.findings.length === 0]),
      outputQuality: metric([
        check('writerInterpreterGrounding'), check('dispositionFidelity'),
        check('conclusionGrounding'), gates.reportStructure
      ])
    };
    gates.conclusionGrounding = check('conclusionGrounding');
    gates.boundedReport = attempt(() => output.reportMarkdown.replace(/\r\n/g, '\n').trim() === reportTemplate(input));
  }
  const thresholds = Object.fromEntries(Object.entries(metrics).map(([name, data]) => [name, {
    threshold: THRESHOLDS[name] ?? 1,
    pass: data.applicable ? data.score >= (THRESHOLDS[name] ?? 1) : null
  }]));
  return {
    agent, metrics, gates, thresholds,
    pass: Object.values(gates).every(Boolean) && Object.values(thresholds).every(data => data.pass !== false)
  };
}

function aggregate(scores) {
  const agents = {};
  for (const score of scores) {
    agents[score.agent] ||= {};
    for (const [name, data] of Object.entries(score.metrics)) {
      configured(data && Number.isInteger(data.matched) && Number.isInteger(data.total)
        && data.matched >= 0 && data.matched <= data.total, `Invalid metric accounting: ${name}`);
      configured(data.applicable === (data.total > 0)
        && (data.applicable ? data.score === data.matched / data.total : data.score === null && nonblank(data.reason)),
      `Invalid applicability or zero-denominator metric: ${name}`);
      const pooled = agents[score.agent][name] ||= { matched: 0, total: 0, applicableCases: 0, naCases: 0 };
      pooled.matched += data.matched;
      pooled.total += data.total;
      pooled[data.applicable ? 'applicableCases' : 'naCases']++;
    }
  }
  for (const metrics of Object.values(agents)) {
    for (const [name, data] of Object.entries(metrics)) {
      data.applicable = data.total > 0;
      data.score = data.applicable ? data.matched / data.total : null;
      data.threshold = THRESHOLDS[name] ?? 1;
      data.pass = data.applicable ? data.score >= data.threshold : null;
      if (!data.applicable) data.reason = 'No applicable cases; not success or coverage.';
    }
  }
  return agents;
}

module.exports = {
  VERSION, THRESHOLDS, scoreStep, aggregate, metric, schemaValid, configured,
  scoreInterpreter: (output, gold, input) => scoreStep('requirement-interpreter', output, input, gold),
  scoreReviewer: (output, gold, input) => scoreStep('adversarial-reviewer', output, input, gold),
  scoreWriter: (output, input) => scoreStep('final-review-writer', output, input, {})
};
