const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cases } = require('../evals/step-cases');
const { checks } = require('../evals/load-bearing-cases');
const { scoreStep, aggregate, metric, THRESHOLDS } = require('../src/eval-scorer');
const { reportTemplate } = require('../src/report-contract');

const clone = value => JSON.parse(JSON.stringify(value));
const context = id => cases.find(value => value.id === id);
const score = (id, output = context(id).output, input = context(id).input, gold = context(id).gold) =>
  scoreStep(context(id).agent, output, input, gold);

test('all full-step gold controls satisfy schema, governance, content, and unchanged thresholds', () => {
  for (const testCase of cases) assert.equal(score(testCase.id).pass, true, testCase.id);
  assert.equal(THRESHOLDS.missingRequirementDetection, 0.85);
  assert.equal(THRESHOLDS.outputQuality, 0.95);
});

test('the integrated scorer rejects every D3 targeted violation, not just mapped criteria', () => {
  let measured = 0;
  for (const check of checks) {
    const testCase = context(check.context);
    for (const negative of check.negatives) {
      const output = clone(testCase.output);
      if (negative.apply) negative.apply(output);
      const result = score(testCase.id, negative.raw === undefined ? output : negative.raw);
      assert.equal(result.pass, false, `${check.id}/${negative.id}`);
      measured++;
    }
  }
  assert.equal(measured, 152);
});

test('keyword soup, changed quantities, units, mappings, and negations earn no proposition credit', () => {
  const output = clone(context('condenser').output);
  output.businessRules = ['vacuum autoodd roof type ecs'];
  assert.equal(score('condenser', output).metrics.requirementExtractionAccuracy.score, 0);
  for (const rule of [
    'Coil Height must be within 1.25 to 100 millimeters.',
    'Coil Height must not be within 1.25 to 100 inches.',
    'The Lamiflo coil increment is 1.25 inches.',
    'The 3/8-inch tube with 1-inch spacing increment is always 1.25 inches.'
  ]) {
    const altered = clone(context('coil').output);
    altered.businessRules[0] = rule;
    assert.equal(score('coil', altered).gates.sourceGrounding, false, rule);
  }
  output.hvacTerminology = ['vacuum'];
  assert.equal(score('condenser', output).metrics.hvacTerminologyRecognition.score, 0);
});

test('field-specific full propositions permit only case/whitespace normalization', () => {
  const output = clone(context('dx').output);
  output.businessRules[0] = `  ${output.businessRules[0].toUpperCase()}  `;
  assert.equal(score('dx', output).pass, true);
  output.businessRules[0] += ' This rule does not apply.';
  assert.equal(score('dx', output).pass, false);
});

test('reviewed semantic equivalents pass without accepting changed quantities or negation', () => {
  const output = clone(context('coil').output);
  output.requirementSummary = context('coil').gold.equivalents.requirementSummary[0];
  output.businessRules[0] = context('coil').gold.equivalents.businessRules[0][0];
  output.businessRules[2] = context('coil').gold.equivalents.businessRules[2][0];
  output.ambiguities[0] = context('coil').gold.equivalents.ambiguities[0][0];
  const result = score('coil', output);
  assert.equal(result.gates.sourceGrounding, true);
  assert.equal(result.thresholds.requirementExtractionAccuracy.pass, true);
  assert.equal(result.thresholds.ambiguityDetection.pass, true);
  assert.equal(result.pass, true);

  output.businessRules[0] = 'Valid coil height range is 1.25" to 1000" inclusive.';
  const changedQuantity = score('coil', output);
  assert.equal(changedQuantity.gates.sourceGrounding, false);
  assert.equal(changedQuantity.thresholds.requirementExtractionAccuracy.pass, false);
  output.businessRules[0] = 'Valid coil height range is not 1.25" to 100" inclusive.';
  const changedPolarity = score('coil', output);
  assert.equal(changedPolarity.gates.sourceGrounding, false);
  assert.equal(changedPolarity.thresholds.requirementExtractionAccuracy.pass, false);
});

test('reviewer accepts reviewed description/action paraphrases and order-insensitive exact citations', () => {
  const output = clone(context('missing').output);
  output.findings[0].description = context('missing').gold.findings[0].equivalents.description[0];
  output.findings[0].action = context('missing').gold.findings[0].equivalents.action[0];
  output.findings[0].sourceRefs.reverse();
  assert.equal(score('missing', output).pass, true);

  output.findings[0].sourceRefs[0].quote = 'The ticket says some height behavior.';
  assert.equal(score('missing', output).pass, false);

  const clean = clone(context('clean-review').output);
  clean.rationale = context('clean-review').gold.rationaleEquivalents[0];
  assert.equal(score('clean-review', clean).pass, true);
});

test('complete reviewer gold accepts multiple valid concerns but rejects unlabelled extras', () => {
  const result = score('hvac');
  assert.equal(result.pass, true);
  assert.equal(result.metrics.hvacInterpretationErrorDetection.matched, 1);
  assert.equal(result.metrics.missingRequirementDetection.matched,
    context('hvac').gold.findings.filter(f => f.category === 'MISSING_REQUIREMENT').length);

  const output = clone(context('hvac').output);
  output.findings.push({
    id: 'FP-EXTRA',
    kind: 'MISSING_REQUIREMENT',
    severity: 'HIGH',
    description: 'The ticket omits the default Aluminum fin material.',
    action: 'Ask the ticket owner to clarify the missing fin-material default.',
    sourceRefs: [{ artifact: 'ticket', pointer: '', quote: 'Aluminum' }],
    ambiguityRefs: []
  });
  assert.equal(score('hvac', output).gates.runtimeContract, true);
  assert.equal(score('hvac', output).gates.falsePositiveControl, false);
});

test('empty expectations are NA, not success; missing mandatory labels fail configuration', () => {
  const result = score('clean-review');
  assert.deepEqual(result.metrics.unsupportedAssumptionDetection, {
    applicable: false, score: null, matched: 0, total: 0,
    reason: 'No applicable source expectations in this fixed case.'
  });
  assert.equal(result.metrics.challengeQuality.total, 2);
  const gold = clone(context('missing').gold);
  delete gold.findings;
  assert.throws(() => score('missing', undefined, undefined, gold), /labels/);
  assert.throws(() => score('dx', undefined, undefined, {}), /gold/);
  assert.throws(() => score('missing', undefined, {}, context('missing').gold), /ticket/);
});

test('false/stale accusations fail against corrected pairs; sample isActive data is not policy', () => {
  for (const id of ['missing', 'assumption', 'hvac', 'validation']) {
    const corrected = context(`${id}-corrected`);
    const invented = clone(corrected.output);
    invented.findings.push(clone(context(id).output.findings[0]));
    invented.status = 'FAIL';
    assert.equal(score(corrected.id, invented).gates.falsePositiveControl, false, id);
  }
  const unsupported = clone(context('assumption').output);
  unsupported.findings[0].description = 'The ticket requires inactive entries to be excluded, but the interpreter omits it.';
  assert.equal(score('assumption', unsupported).pass, false);
});

test('first-review IDs are not gold wording; continuity and duplicate concerns still enforced', () => {
  const output = clone(context('missing').output);
  output.findings[0].id = 'MODEL-F001';
  assert.equal(score('missing', output).pass, true);
  output.findings.push({ ...clone(output.findings[0]), id: 'MODEL-F002' });
  assert.equal(score('missing', output).gates.falsePositiveControl, false);
  const retained = clone(context('retained').output);
  retained.findings[0].id = 'MODEL-F001';
  assert.equal(score('retained', retained).gates.concernContinuity, false);
});

test('invalid status, missing action, invented evidence, and meaningless long findings cannot earn PASS', () => {
  for (const mutate of [
    output => { output.status = 'INVALID'; },
    output => { delete output.findings[0].action; },
    output => { output.findings[0].sourceRefs[0].quote = 'Invented evidence'; },
    output => { output.findings[0].description = 'Meaningless general observations '.repeat(5); },
    output => { output.findings[0].action = 'Fix it.'; },
    output => { output.findings[0].severity = output.findings[0].severity === 'HIGH' ? 'LOW' : 'HIGH'; }
  ]) {
    const output = clone(context('missing').output);
    mutate(output);
    assert.equal(score('missing', output).pass, false);
  }
  const open = clone(context('open').output);
  open.status = 'PASS';
  open.findings = [];
  assert.equal(score('open', open).gates.runtimeContract, false);
});

test('empty reports, heading-only credit, two-word overlap, and unsupported clearance are rejected', () => {
  for (const reportMarkdown of [
    '# PASS\nSummary\nFindings\nDisposition',
    '# FAIL\nSummary\nFindings\nDisposition: PASS',
    '# FAIL\n- F1 | LOW | range precision\nHIGH\nNo concerns remain.'
  ]) {
    const result = score('writer-fail', { reportMarkdown });
    assert.equal(result.pass, false);
    assert.equal(result.metrics.findingPreservation.score, 0);
    assert.equal(result.metrics.findingPreservation.total, 1);
  }
  const original = context('writer-fail').output.reportMarkdown;
  for (const reportMarkdown of [
    original.replace('# FAIL', '# FAILURE'),
    original.replace('## Final Disposition\n\nFAIL', '## Final Disposition\n\nPASS'),
    original.replace('| MEDIUM |', '| LOW |'),
    original + '\nNo outstanding concerns remain.'
  ]) assert.equal(score('writer-fail', { reportMarkdown }).pass, false);
});

test('no-finding writer assertions use denominator 1; incidental below is not LOW severity', () => {
  const input = clone(context('writer-pass').input);
  input.interpreterResult.requirementSummary = 'Display the height below the label.';
  const output = { reportMarkdown: reportTemplate(input) };
  assert.equal(score('writer-pass', output, input).pass, true);
  output.reportMarkdown += '\n- NEW | HIGH | MISSING_REQUIREMENT | "Invented." | "Invented."';
  const bad = score('writer-pass', output, input);
  assert.equal(bad.metrics.findingPreservation.score, 0);
  assert.equal(bad.metrics.findingPreservation.total, 1);
  assert.equal(aggregate([bad])['final-review-writer'].findingPreservation.score, 0);
});

test('writer cannot clear open ambiguities even if reviewer supplied PASS/empty', () => {
  const input = clone(context('writer-pass').input);
  input.interpreterResult.ambiguities = ['How are rounding ties handled?'];
  assert.equal(score('writer-pass', undefined, input).gates.upstreamContract, false);
});

test('metric accounting rejects 0/0 failures and preserves Boolean failures and NA separately', () => {
  assert.throws(() => aggregate([{
    agent: 'final-review-writer', metrics: { findingPreservation: { applicable: true, matched: 0, total: 0, score: 0 } }
  }]), /zero-denominator/);
  const pooled = aggregate([{ agent: 'test', metrics: { content: metric([]), safety: metric([false]) } }]);
  assert.equal(pooled.test.content.score, null);
  assert.equal(pooled.test.content.pass, null);
  assert.equal(pooled.test.safety.score, 0);
  assert.equal(pooled.test.safety.total, 1);
});

test('threshold decisions use unrounded fractions', () => {
  const matched = 8496;
  const total = 10000;
  const pooled = aggregate([{
    agent: 'adversarial-reviewer',
    metrics: { missingRequirementDetection: { applicable: true, matched, total, score: matched / total } }
  }]);
  const data = pooled['adversarial-reviewer'].missingRequirementDetection;
  assert.equal(Number(data.score.toFixed(3)), 0.85);
  assert.equal(data.pass, false);
});

test('malformed candidates fail scoring instead of crashing or receiving default artifacts', () => {
  for (const candidate of [null, {}, 'null', '[]', '```json\n{}\n```', { findings: 42 }, 'not JSON']) {
    for (const id of ['dx', 'missing', 'writer-pass']) assert.equal(score(id, candidate).pass, false, id);
  }
});
