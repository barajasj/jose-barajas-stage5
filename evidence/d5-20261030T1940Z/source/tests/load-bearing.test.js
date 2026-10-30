const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runAudit, inventoryPrompt } = require('../src/run-load-bearing-audit');
const { evaluateCriterion } = require('../src/load-bearing-criteria');
const { contexts, checks } = require('../evals/load-bearing-cases');
const manifest = require('../evals/load-bearing-map.json');

test('every coverage criterion accepts its valid counterpart and rejects every targeted mutation', () => {
  const result = runAudit();
  assert.deepEqual(result.errors, []);
  assert.equal(result.pass, true);
  assert.equal(result.modelPerformanceMeasured, false);
  for (const agent of Object.values(result.agents)) {
    assert.equal(agent.coverage, 1);
    assert.equal(agent.unmapped.length, 0);
    assert.ok(agent.total > 0);
  }
});

test('coverage preflight notices unnumbered paragraphs, list items, and unknown input slots', () => {
  const units = inventoryPrompt('# Role\n\n- [I01] Rule.\n\nUnmeasured prose.\n\n- Hidden rule.\n\n{{unknown}}');
  assert.equal(units.length, 4);
  assert.equal(units.filter(unit => unit.id === null).length, 2);
  assert.equal(units[3].id, 'input:unknown');
});

test('unknown criteria and missing gold labels fail configuration instead of receiving credit', () => {
  assert.throws(() => evaluateCriterion('notImplemented', 'requirement-interpreter', {}, '{}', {}), /criterion/i);
  assert.throws(() => evaluateCriterion(
    'summaryAccuracy', 'requirement-interpreter', {}, '{}', {}
  ), /label/i);
});

test('source fixtures and full propositions are fixed, rather than inferred from candidate keywords', () => {
  assert.ok(contexts.length > 5);
  assert.ok(checks.length > 20);
  for (const context of contexts) {
    if (context.sourceQuotes) {
      for (const quote of context.sourceQuotes) {
        assert.ok(context.input.ticket.includes(quote), `${context.id}: source quote absent`);
      }
    }
    assert.ok(context.provenance);
  }
});

test('removing mappings or substituting an unmeasured criterion fails the audit', () => {
  const copy = JSON.parse(JSON.stringify(manifest));
  delete copy.agents['requirement-interpreter'].units.I08;
  copy.agents['adversarial-reviewer'].units.R03 = ['notImplemented'];
  const result = runAudit({ auditManifest: copy });
  assert.equal(result.pass, false);
  assert.ok(result.agents['requirement-interpreter'].unmapped.some(unit => unit.id === 'I08'));
  assert.ok(result.agents['adversarial-reviewer'].unmapped.some(unit => unit.id === 'R03'));
});

test('omitting an entire agent cannot inflate coverage', () => {
  const copy = JSON.parse(JSON.stringify(manifest));
  delete copy.agents['final-review-writer'];
  const result = runAudit({ auditManifest: copy });
  assert.equal(result.pass, false);
  assert.ok(result.errors.some(error => error.includes('three runtime agents')));
});

test('changed units and negated propositions do not pass through shared keywords', () => {
  const coil = contexts.find(context => context.id === 'coil');
  for (const value of [
    'Coil Height must be within 1.25 to 100 millimeters.',
    'Coil Height must not be within 1.25 to 100 inches.'
  ]) {
    const output = JSON.parse(JSON.stringify(coil.output));
    output.businessRules[0] = value;
    assert.equal(evaluateCriterion(
      'validationRuleAccuracy', coil.agent, coil.input, JSON.stringify(output), coil.gold
    ), false);
  }
});

test('criteria remain field-specific and bounded report checks distinguish content from labels', () => {
  const coil = contexts.find(context => context.id === 'coil');
  const output = JSON.parse(JSON.stringify(coil.output));
  output.requirementSummary = 'Generic review.';
  output.developerConsiderations.push(coil.output.requirementSummary);
  assert.equal(evaluateCriterion(
    'summaryAccuracy', coil.agent, coil.input, JSON.stringify(output), coil.gold
  ), false);
  const writer = contexts.find(context => context.id === 'writer-fail');
  assert.equal(evaluateCriterion('conclusionGrounding', writer.agent, writer.input,
    JSON.stringify({ reportMarkdown: '# FAIL\nSummary\nFindings\nDisposition' }), writer.gold), false);
});

test('the standalone command exposes reproducible coverage without claiming model performance', () => {
  const child = spawnSync(process.execPath, [
    path.join(__dirname, '../src/run-load-bearing-audit.js'), '--json'
  ], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.pass, true);
  assert.equal(result.modelPerformanceMeasured, false);
  assert.equal(result.examinerParserEquivalent, false);
  assert.ok(result.negativeControls > result.checks);
  for (const file of ['src/load-bearing-criteria.js', 'evals/load-bearing-cases.js']) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', file)));
    assert.match(result.hashes[file], /^[a-f0-9]{64}$/);
  }
});
