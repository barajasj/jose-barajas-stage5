const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const vm = require('node:vm');
const { validateSchema } = require('../src/schema-validator');
const {
  validateReview,
  validateInterpretationTransition,
  deriveDisposition
} = require('../src/governance-policy');
const {
  reportTemplate,
  validateReport
} = require('../src/report-contract');
const { createAgentRunner } = require('../src/agent-runner');
const { executeWorkflow } = require('../src/coordinator');
const { buildPrompt } = require('../src/prompt-builder');

const ticket = 'Calculate DX Coil Height as the sum of circuit heights.';
const interpretation = (ambiguities = []) => ({
  requirementSummary: ticket,
  hvacTerminology: ['DX Coil'],
  businessRules: [ticket],
  developerConsiderations: [],
  ambiguities,
  confidence: ambiguities.length ? 'MEDIUM' : 'HIGH'
});
const source = () => ({ artifact: 'ticket', pointer: '', quote: ticket });
const finding = (overrides = {}) => ({
  id: 'F1',
  severity: 'HIGH',
  kind: 'MISSING_REQUIREMENT',
  description: 'The interpretation omits the stated summation behavior.',
  action: 'Restore the stated summation behavior.',
  sourceRefs: [source()],
  ambiguityRefs: [],
  ...overrides
});
const review = (findings = []) => ({
  status: findings.length ? 'FAIL' : 'PASS',
  rationale: findings.length
    ? 'The supplied artifacts have unresolved concerns.'
    : 'The stated summation is captured and no ambiguities remain.',
  findings,
  resolutions: []
});

test('review schema rejects inconsistent status, blank findings, and extra fields', () => {
  for (const output of [
    { ...review([finding()]), status: 'PASS' },
    { ...review(), status: 'FAIL' },
    review([finding({ description: '   ' })]),
    review([finding({ ambiguityRefs: undefined })]),
    review([finding({ unexpected: true })]),
    { ...review(), status: 'INVALID' }
  ]) {
    assert.equal(validateSchema(output, 'schemas/challenges.schema.json').valid, false);
  }
  assert.equal(validateSchema(review(), 'schemas/challenges.schema.json').valid, true);
  assert.equal(validateSchema(review([finding()]), 'schemas/challenges.schema.json').valid, true);
});

test('agent prompts state the exact reviewer and writer contract details that caused workflow rejection', () => {
  const reviewerPrompt = fs.readFileSync(path.join(
    __dirname, '../agents/adversarial-reviewer.md'
  ), 'utf8');
  assert.match(reviewerPrompt, /Copy each source quote verbatim/);
  assert.match(reviewerPrompt, /ALWAYS include ambiguityRefs: \[\]/);

  const writerPrompt = fs.readFileSync(path.join(
    __dirname, '../agents/final-review-writer.md'
  ), 'utf8');
  assert.match(writerPrompt, /Copy the bounded reportTemplate/);
  assert.match(writerPrompt, /JSON\.parse\(\) of your response produces the original template text/);
});

test('all findings block PASS regardless of model-declared status or severity', () => {
  for (const severity of ['LOW', 'MEDIUM', 'HIGH']) {
    assert.equal(deriveDisposition(interpretation(), review([finding({ severity })])).disposition, 'FAIL');
    assert.throws(() => validateReview(
      { ...review([finding({ severity })]), status: 'PASS' },
      { ticket, interpreterResult: interpretation() }
    ), /status/i);
  }
  assert.throws(() => validateReview(
    { ...review(), status: 'FAIL' },
    { ticket, interpreterResult: interpretation() }
  ), /status/i);
});

test('open ambiguities block clearance and require exact reviewer coverage', () => {
  const io = interpretation(['Tie-breaking is unspecified.']);
  assert.equal(deriveDisposition(io, review()).disposition, 'FAIL');
  assert.throws(() => validateReview(review(), { ticket, interpreterResult: io }), /ambigu/i);
  const concern = finding({
    kind: 'OPEN_AMBIGUITY',
    ambiguityRefs: ['/ambiguities/0'],
    sourceRefs: [{
      artifact: 'interpreter',
      pointer: '/ambiguities/0',
      quote: io.ambiguities[0]
    }]
  });
  assert.doesNotThrow(() => validateReview(review([concern]), { ticket, interpreterResult: io }));
  assert.throws(() => validateReview(review([{
    ...concern, ambiguityRefs: ['/ambiguities/1']
  }]), { ticket, interpreterResult: io }), /ambigu/i);
});

test('finding IDs, source quotes, and previous concern resolutions are checked', () => {
  const input = { ticket, interpreterResult: interpretation() };
  assert.throws(() => validateReview(review([finding(), finding()]), input), /duplicate/i);
  assert.throws(() => validateReview(review([finding({
    sourceRefs: [{ ...source(), quote: 'An invented requirement.' }]
  })]), input), /source/i);
  const previousReview = review([finding()]);
  assert.throws(() => validateReview(review(), { ...input, previousReview }), /resol/i);
  assert.doesNotThrow(() => validateReview({
    ...review(),
    resolutions: [{
      findingId: 'F1',
      rationale: 'The corrected interpretation now contains the summation.',
      sourceRefs: [{
        artifact: 'interpreter', pointer: '/businessRules/0', quote: ticket
      }]
    }]
  }, { ...input, previousReview }));
});

test('redispatch cannot erase ambiguities without an explicit sourced resolution', () => {
  const previousInterpretation = interpretation(['How are circuit heights combined?']);
  assert.throws(() => validateInterpretationTransition(
    interpretation(), { ticket, previousInterpretation }
  ), /ambigu/i);
  assert.doesNotThrow(() => validateInterpretationTransition({
    ...interpretation(),
    ambiguityResolutions: [{
      ambiguity: previousInterpretation.ambiguities[0],
      rationale: 'The ticket explicitly states that heights are summed.',
      sourceQuote: ticket
    }]
  }, { ticket, previousInterpretation }));
  assert.throws(() => validateInterpretationTransition({
    ...interpretation(),
    ambiguityResolutions: [{
      ambiguity: previousInterpretation.ambiguities[0],
      rationale: 'Assume a default.',
      sourceQuote: 'Use an invented default.'
    }]
  }, { ticket, previousInterpretation }), /source/i);
});

test('interpreter prompt keys resolutions to exact prior ambiguities and retains unanswered policy', () => {
  const prompt = fs.readFileSync(path.join(
    __dirname, '../agents/requirement-interpreter.md'
  ), 'utf8');
  assert.match(prompt, /copy ambiguity byte-for-byte from previousInterpretation\.ambiguities/);
  assert.match(prompt, /Removing an unsupported business rule does not resolve an ambiguity/);
  assert.match(prompt, /Reviewer paraphrase:/);

  const ticket2 = fs.readFileSync(path.join(__dirname, '../fixtures/hvac-ticket-2.md'), 'utf8');
  const previous = [
    'If Unit Size filtering should also consider Condenser Type in addition to Refrigerant and Unit Type.',
    'How should entries with isActive:false be handled?'
  ];
  const unitSizeQuote =
    'When we select the Unit Type, we should see the Unit Size dropdown filtered by Refrigerant + Unit Type selected.';
  const output = {
    ...interpretation([previous[1]]),
    businessRules: [unitSizeQuote],
    ambiguityResolutions: [{
      ambiguity: previous[0],
      rationale: 'The ticket specifies the Unit Size filter as Refrigerant + Unit Type.',
      sourceQuote: unitSizeQuote
    }]
  };
  const input = { ticket: ticket2, previousInterpretation: interpretation(previous) };
  assert.equal(validateSchema(output, 'schemas/examiner.schema.json').valid, true);
  assert.doesNotThrow(() => validateInterpretationTransition(output, input));

  assert.throws(() => validateInterpretationTransition({
    ...output,
    ambiguityResolutions: [{
      ...output.ambiguityResolutions[0],
      ambiguity: 'Unclear if Unit Size filtering should also consider Condenser Type in addition to Refrigerant and Unit Type.'
    }]
  }, input), /identify a removed prior ambiguity/i);
  assert.throws(() => validateInterpretationTransition({
    ...output,
    ambiguities: [],
    ambiguityResolutions: output.ambiguityResolutions
  }, input), /without a sourced resolution/i);
  assert.throws(() => validateInterpretationTransition({
    ...output,
    ambiguityResolutions: [...output.ambiguityResolutions, output.ambiguityResolutions[0]]
  }, input), /duplicate/i);
  assert.deepEqual(output.ambiguities, [previous[1]]);
  assert.equal(output.businessRules.some(rule => /isActive/.test(rule)), false);
});

test('report contract preserves all inputs and rejects unsupported or opposing conclusions', () => {
  const io = interpretation(['Tie-breaking is unspecified.']);
  const ro = review([finding({
    severity: 'MEDIUM',
    kind: 'OPEN_AMBIGUITY',
    ambiguityRefs: ['/ambiguities/0']
  })]);
  const input = {
    interpreterResult: io,
    reviewResult: ro,
    ...deriveDisposition(io, ro)
  };
  const markdown = reportTemplate(input);
  assert.doesNotThrow(() => validateReport({ reportMarkdown: markdown }, input));
  for (const changed of [
    markdown + '\nNo outstanding concerns remain.',
    markdown.replace('# FAIL', '# PASS'),
    markdown.replace('MEDIUM', 'LOW'),
    markdown.replace(io.ambiguities[0], ''),
    markdown.replace(ro.findings[0].description, ''),
    '# FAIL\nSummary\nFindings\nDisposition: PASS'
  ]) {
    assert.throws(() => validateReport({ reportMarkdown: changed }, input), /report/i);
  }
});

function workspace(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stage5-runtime-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const assessmentFile = path.join(root, 'assessment.json');
  fs.writeFileSync(assessmentFile, JSON.stringify({
    workflows: [],
    overallAssessment: { humanReviewRequired: false }
  }));
  return {
    root,
    assessmentFile,
    decisionsFile: path.join(root, 'decisions.jsonl'),
    runsDir: path.join(root, 'runs'),
    auditFile: path.join(root, 'audit.jsonl'),
    runtimeMode: 'real'
  };
}

function modelSequence(outputs) {
  const calls = [];
  const runner = createAgentRunner({
    invokeModel: async request => {
      calls.push(request);
      assert.ok(outputs.length, 'Unexpected model call');
      const next = outputs.shift();
      const value = typeof next === 'function' ? next(request) : next;
      return {
        content: typeof value === 'string' ? value : JSON.stringify(value),
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      };
    }
  });
  return { calls, agentRunner: runner };
}

const exactWriter = ({ prompt }) => ({
  reportMarkdown: prompt.replace(/\r\n/g, '\n').split('Required Report Markdown:\n\n')[1]
});

test('coordinator rejects initial and post-redispatch status contradictions', async t => {
  for (const afterRedispatch of [false, true]) {
    for (const invalid of [
      { ...review([finding()]), status: 'PASS' },
      { ...review(), status: 'FAIL' }
    ]) {
      const options = workspace(t);
      const outputs = afterRedispatch
        ? [interpretation(), review([finding()]), interpretation(), invalid]
        : [interpretation(), invalid];
      const model = modelSequence(outputs);
      const result = await executeWorkflow(ticket, { ...options, ...model });
      assert.equal(result.disposition, 'FAIL');
      assert.equal(result.status, 'SCHEMA_FAILURE');
      assert.equal(model.calls.length, afterRedispatch ? 4 : 2);
      assert.equal(result.finalReport, undefined);
    }
  }
});

test('all configured cycles are honored, with persistent HIGH never passing', async t => {
  for (const maxReviewCycles of [1, 2, 3]) {
    const options = workspace(t);
    const outputs = Array.from({ length: maxReviewCycles }, () =>
      [interpretation(), review([finding()])]
    ).flat();
    const model = modelSequence([...outputs, exactWriter]);
    const result = await executeWorkflow(ticket, { ...options, ...model, maxReviewCycles });
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.disposition, 'FAIL');
    assert.equal(result.reviewCycles.length, maxReviewCycles);
    assert.equal(result.auditSummary.stepsExecuted, maxReviewCycles * 2 + 1);
    assert.equal(result.auditSummary.reviewLimitReached, true);
    assert.equal(result.auditSummary.reDispatched, maxReviewCycles > 1);
    assert.equal(result.auditSummary.totalTokens, (maxReviewCycles * 2 + 1) * 30);
  }
});

test('grounded correction can reach PASS without inventing missing ticket facts', async t => {
  const options = workspace(t);
  const correctedReview = {
    ...review(),
    resolutions: [{
      findingId: 'F1',
      rationale: 'The current business rule now states the ticket summation.',
      sourceRefs: [{ artifact: 'interpreter', pointer: '/businessRules/0', quote: ticket }]
    }]
  };
  const model = modelSequence([
    { ...interpretation(), businessRules: ['Display height.'] },
    review([finding()]),
    interpretation(),
    correctedReview,
    exactWriter
  ]);
  const result = await executeWorkflow(ticket, { ...options, ...model });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.disposition, 'PASS');
  assert.deepEqual(result.reasonCodes, ['NO_OPEN_CONCERNS']);
  assert.equal(result.reviewCycles.length, 2);
});

test('valid unresolved ambiguity produces FAIL without futile interpretation retries', async t => {
  const options = workspace(t);
  const io = interpretation(['How should missing circuit heights be handled?']);
  const concern = finding({
    kind: 'OPEN_AMBIGUITY',
    ambiguityRefs: ['/ambiguities/0'],
    sourceRefs: [{
      artifact: 'interpreter', pointer: '/ambiguities/0', quote: io.ambiguities[0]
    }]
  });
  const model = modelSequence([io, review([concern]), exactWriter]);
  const result = await executeWorkflow(ticket, { ...options, ...model, maxReviewCycles: 3 });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.disposition, 'FAIL');
  assert.equal(result.reviewCycles.length, 1);
  assert.deepEqual(result.reasonCodes, ['OPEN_FINDINGS', 'OPEN_AMBIGUITIES']);
});

test('both cited ambiguity/PASS failures are blocked by runtime policy', async t => {
  const runs = [
    JSON.parse(fs.readFileSync(path.join(__dirname, '../evidence/ticket4-run.json'), 'utf8'))
      .finalInterpreterResult.output,
    JSON.parse(fs.readFileSync(path.join(
      __dirname, '../runs/HVAC-TICKET-1792693686495/requirement-interpreter.json'
    ), 'utf8'))
  ];
  for (const io of runs) {
    const options = workspace(t);
    const model = modelSequence([io, review()]);
    const result = await executeWorkflow(ticket, { ...options, ...model });
    assert.equal(result.disposition, 'FAIL');
    assert.equal(result.status, 'GOVERNANCE_FAILURE');
    assert.match(result.reason, /ambigu/i);
    assert.equal(model.calls.length, 2);
  }
});

test('invalid writer is rejected before validated artifact or SUCCESS audit', async t => {
  const options = workspace(t);
  const model = modelSequence([
    interpretation(),
    review(),
    ({ prompt }) => ({
      reportMarkdown: exactWriter({ prompt }).reportMarkdown + '\nAll requirements are satisfied.'
    })
  ]);
  const result = await executeWorkflow(ticket, { ...options, ...model });
  assert.equal(result.status, 'GOVERNANCE_FAILURE');
  assert.equal(result.disposition, 'FAIL');
  const dir = path.join(options.runsDir, result.correlationId, 'cycle-1');
  assert.equal(fs.existsSync(path.join(dir, 'final-review-writer-raw.txt')), true);
  assert.equal(fs.existsSync(path.join(dir, 'final-review-writer-parsed.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'final-review-writer-validated.json')), false);
  const entries = fs.readFileSync(options.auditFile, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(entries.some(e => e.agent === 'final-review-writer' && e.status === 'SUCCESS'), false);
});

test('returned and persisted reports are identical and each cycle is immutable', async t => {
  const options = workspace(t);
  const model = modelSequence([
    interpretation(), review([finding()]),
    interpretation(), review([finding()]), exactWriter
  ]);
  const result = await executeWorkflow(ticket, { ...options, ...model });
  const dir = path.join(options.runsDir, result.correlationId);
  const saved = JSON.parse(fs.readFileSync(path.join(
    dir, 'cycle-2/final-review-writer-validated.json'
  ), 'utf8'));
  assert.deepEqual(saved, result.finalReport.output);
  assert.ok(fs.existsSync(path.join(dir, 'cycle-1/requirement-interpreter-validated.json')));
  assert.ok(fs.existsSync(path.join(dir, 'cycle-2/requirement-interpreter-validated.json')));
  const manifest = JSON.parse(fs.readFileSync(path.join(
    dir, 'cycle-2/final-review-writer-manifest.json'
  ), 'utf8'));
  for (const key of ['inputHash', 'promptHash', 'schemaHash', 'rawHash', 'outputHash']) {
    assert.match(manifest[key], /^[a-f0-9]{64}$/);
  }
  const original = fs.readFileSync(path.join(dir, 'cycle-1/requirement-interpreter-input.json'));
  await assert.rejects(() => model.agentRunner(
    'requirement-interpreter', { ticket }, result.correlationId, options
  ));
  assert.deepEqual(fs.readFileSync(path.join(
    dir, 'cycle-1/requirement-interpreter-input.json'
  )), original);
});

test('agent input allowlists reject history/tools/ticket access before model invocation', async t => {
  for (const [agentId, input] of [
    ['requirement-interpreter', { ticket, conversationHistory: [] }],
    ['adversarial-reviewer', { ticket, interpreterResult: interpretation(), tools: ['read_file'] }],
    ['final-review-writer', {
      ticket, interpreterResult: interpretation(), reviewResult: review(),
      ...deriveDisposition(interpretation(), review())
    }]
  ]) {
    const options = workspace(t);
    const model = modelSequence([]);
    await assert.rejects(() => model.agentRunner(agentId, input, 'BOUNDARY-TEST', options), /allowlist/i);
    assert.equal(model.calls.length, 0);
  }
});

test('prompt substitution does not evaluate placeholders embedded in supplied artifacts', () => {
  assert.equal(buildPrompt('{{ticket}}\n{{disposition}}', {
    ticket: 'Untrusted {{disposition}}', disposition: 'FAIL'
  }), 'Untrusted {{disposition}}\nFAIL');
  assert.throws(() => buildPrompt('{{missing}}', {}), /Missing prompt input/);
});

test('invalid runtime settings stop before dispatch', async t => {
  for (const extra of [
    { maxReviewCycles: 0 }, { maxReviewCycles: -1 }, { maxReviewCycles: 1.5 },
    { runtimeMode: 'typo' }
  ]) {
    const options = workspace(t);
    const model = modelSequence([]);
    const result = await executeWorkflow(ticket, { ...options, ...model, ...extra });
    assert.equal(result.status, 'GOVERNANCE_FAILURE');
    assert.equal(result.disposition, 'FAIL');
    assert.equal(model.calls.length, 0);
  }
});

test('human continue does not clear findings and human reject prevents writer dispatch', async t => {
  for (const decision of ['CONTINUE', 'APPROVE', 'REJECT']) {
    const options = workspace(t);
    fs.writeFileSync(options.assessmentFile, JSON.stringify({
      overallAssessment: { humanReviewRequired: true }
    }));
    fs.writeFileSync(options.decisionsFile, JSON.stringify({
      decision, reviewer: 'Runtime test', reason: 'Continue the assessment, not clearance.',
      timestamp: new Date().toISOString()
    }) + '\n');
    const concern = finding({ severity: 'MEDIUM' });
    const model = modelSequence([interpretation(), review([concern]), exactWriter]);
    const result = await executeWorkflow(ticket, { ...options, ...model });
    if (decision === 'REJECT') {
      assert.equal(result.disposition, 'REJECTED_BY_HUMAN');
      assert.equal(model.calls.length, 2);
      assert.equal(result.finalReport, undefined);
    } else {
      assert.equal(result.status, 'COMPLETED_AFTER_HUMAN_APPROVAL');
      assert.equal(result.disposition, 'FAIL');
      assert.equal(model.calls.length, 3);
    }
  }
});

test('existing eight human-gate scenarios pass in isolated mock workspace', t => {
  const options = workspace(t);
  const child = spawnSync(process.execPath, [
    path.join(__dirname, '../src/test-punchout.js')
  ], {
    cwd: options.root,
    env: { ...process.env, RUNTIME_MODE: 'mock', AUDIT_FILE: options.auditFile },
    encoding: 'utf8'
  });
  assert.equal(child.status, 0, child.stdout + child.stderr);
  const result = JSON.parse(fs.readFileSync(path.join(
    options.root, 'runs/punchout-test-results.json'
  ), 'utf8'));
  assert.equal(result.passed, 8);
});

test('model client sends independent authorized messages without tools or shared history', async () => {
  const requests = [];
  class FakeOpenAI {
    constructor() {
      this.chat = { completions: { create: async request => {
        requests.push(request);
        return { choices: [{ message: { content: '{}' } }] };
      } } };
    }
  }
  const sandbox = {
    module: { exports: {} },
    process: { env: {} },
    require: name => name === 'openai' ? FakeOpenAI : { config: () => {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(
    __dirname, '../src/models/fireworks-client.js'
  ), 'utf8'), sandbox);
  await sandbox.module.exports.invokeLlm({ model: 'test', prompt: 'Producer context' });
  await sandbox.module.exports.invokeLlm({ model: 'test', prompt: 'Authorized reviewer input' });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].messages.length, 1);
  assert.equal(requests[1].messages[0].role, 'user');
  assert.equal(requests[1].messages[0].content, 'Authorized reviewer input');
  assert.equal(Object.hasOwn(requests[1], 'tools'), false);
});

test('CLI returns structured failure and a nonzero exit for invalid mode', t => {
  const options = workspace(t);
  const ticketPath = path.join(options.root, 'ticket.md');
  const outputPath = path.join(options.root, 'result.json');
  fs.writeFileSync(ticketPath, ticket);
  const child = spawnSync(process.execPath, [
    path.join(__dirname, '../src/run-workflow.js'), ticketPath, outputPath
  ], {
    cwd: options.root,
    env: {
      ...process.env,
      RUNTIME_MODE: 'invalid',
      AUDIT_FILE: options.auditFile,
      RUNS_DIR: options.runsDir
    },
    encoding: 'utf8'
  });
  assert.equal(child.status, 1, child.stdout + child.stderr);
  const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(result.disposition, 'FAIL');
  assert.equal(result.status, 'GOVERNANCE_FAILURE');
});

test('malformed JSON and invalid schema retain rejected responses without SUCCESS', async t => {
  for (const [raw, status] of [
    ['```json\n{}\n```', 'JSON_PARSE_FAILURE'],
    ['null', 'SCHEMA_FAILURE'],
    ['{}', 'SCHEMA_FAILURE']
  ]) {
    const options = workspace(t);
    const model = modelSequence([raw]);
    const result = await executeWorkflow(ticket, { ...options, ...model });
    assert.equal(result.disposition, 'FAIL');
    assert.equal(result.status, status);
    const dir = path.join(options.runsDir, result.correlationId, 'cycle-1');
    assert.equal(fs.readFileSync(path.join(
      dir, 'requirement-interpreter-raw.txt'
    ), 'utf8'), raw);
    assert.equal(fs.existsSync(path.join(dir, 'requirement-interpreter-validated.json')), false);
    const audit = fs.readFileSync(options.auditFile, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(audit.some(entry => entry.status === 'SUCCESS'), false);
  }
});

test('provider errors are sanitized and cannot result in PASS', async t => {
  const options = workspace(t);
  const runner = createAgentRunner({
    invokeModel: async () => { throw new Error('Sensitive provider diagnostic'); }
  });
  const result = await executeWorkflow(ticket, { ...options, agentRunner: runner });
  assert.equal(result.status, 'MODEL_FAILURE');
  assert.equal(result.disposition, 'FAIL');
  assert.equal(result.reason, 'Model request failed.');
  assert.equal(fs.readFileSync(options.auditFile, 'utf8').includes('Sensitive provider diagnostic'), false);
});

test('report inputs cannot bypass an inconsistent review or missing ambiguity coverage', () => {
  for (const input of [
    {
      interpreterResult: interpretation(),
      reviewResult: { ...review(), status: 'FAIL' },
      disposition: 'PASS', reasonCodes: ['NO_OPEN_CONCERNS']
    },
    {
      interpreterResult: interpretation(['Missing validation policy.']),
      reviewResult: review(),
      disposition: 'FAIL', reasonCodes: ['OPEN_AMBIGUITIES']
    }
  ]) {
    assert.throws(() => reportTemplate(input), /review/i);
  }
});

test('mock CLI is explicitly labeled and works without an API key', t => {
  const options = workspace(t);
  fs.writeFileSync(path.join(options.root, 'ticket.md'), ticket);
  fs.writeFileSync(path.join(options.root, 'substance-assessment.json'),
    fs.readFileSync(options.assessmentFile));
  const outputPath = path.join(options.root, 'result.json');
  const child = spawnSync(process.execPath, [
    path.join(__dirname, '../src/run-workflow.js'),
    path.join(options.root, 'ticket.md'),
    outputPath
  ], {
    cwd: options.root,
    env: {
      ...process.env,
      RUNTIME_MODE: 'mock',
      MAX_REVIEW_CYCLES: '2',
      AI_API_KEY: '',
      AUDIT_FILE: options.auditFile,
      RUNS_DIR: options.runsDir
    },
    encoding: 'utf8'
  });
  assert.equal(child.status, 0, child.stdout + child.stderr);
  const result = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(result.runtimeMode, 'mock');
  assert.equal(result.disposition, 'FAIL');
  assert.equal(result.auditSummary.reviewCyclesExecuted, 2);
  assert.equal(result.totalCost, 0);
  assert.equal(result.finalReport.runtimeMode, 'mock');
});

test('CLI emits structured errors for missing ticket input', t => {
  const options = workspace(t);
  const child = spawnSync(process.execPath, [
    path.join(__dirname, '../src/run-workflow.js'), path.join(options.root, 'missing.md')
  ], {
    cwd: options.root,
    env: { ...process.env, RUNTIME_MODE: 'mock', AUDIT_FILE: options.auditFile },
    encoding: 'utf8'
  });
  assert.equal(child.status, 1);
  assert.equal(JSON.parse(child.stderr).disposition, 'FAIL');
});
