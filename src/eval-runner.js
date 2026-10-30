const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { cases } = require('../evals/step-cases');
const defaults = require('../evals/test-cases.json');
const { VERSION, THRESHOLDS, scoreStep, aggregate, configured } = require('./eval-scorer');
const { runAudit } = require('./run-load-bearing-audit');
const { hash, inputHash, readJson, validateObservation, workflowObservations, comparePaired } = require('./eval-evidence');

const root = path.resolve(__dirname, '..');
const scorerFiles = ['src/eval-scorer.js', 'src/load-bearing-criteria.js', 'src/governance-policy.js',
  'src/report-contract.js', 'src/schema-validator.js', 'schemas/examiner.schema.json',
  'schemas/challenges.schema.json', 'schemas/final-review.schema.json'];
const scorerHash = () => hash(JSON.stringify(scorerFiles.map(file => [file, hash(fs.readFileSync(path.join(root, file)))])));

function readBaseline(definition) {
  configured(definition && ['required', 'not-in-baseline'].includes(definition.state), 'Explicit baseline applicability required.');
  if (definition.state === 'not-in-baseline') {
    configured(typeof definition.reason === 'string' && definition.reason.trim(), 'Absent baseline requires a reason.');
    return null;
  }
  if (definition.ref) {
    configured(/^[a-f0-9]{7,40}$/.test(definition.ref)
      && typeof definition.file === 'string' && !definition.file.startsWith('-'), 'Invalid baseline ref/path.');
    return JSON.parse(execFileSync('git', ['show', `${definition.ref}:${definition.file}`],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  }
  configured(typeof definition.file === 'string', 'Required baseline file is missing.');
  return readJson(path.resolve(root, definition.file));
}

function scoredObservation(observation, testCase, versionHash, mode) {
  if (mode !== 'authored-controls') validateObservation(observation, testCase);
  return {
    caseId: testCase.id, agent: testCase.agent, inputHash: inputHash(testCase.input),
    model: observation.provenance?.model || null, modelSettings: observation.provenance?.modelSettings || null,
    scorerHash: versionHash, score: scoreStep(testCase.agent, observation.rawResponse, testCase.input, testCase.gold)
  };
}

function evaluateDirect(responses, versionHash) {
  configured(responses && Array.isArray(responses.observations), 'Response file must contain observations.');
  const allowed = new Set(cases.map(testCase => testCase.id));
  const seen = new Set();
  const rows = [];
  const errors = [];
  for (const observation of responses.observations) {
    if (!allowed.has(observation.caseId) || seen.has(observation.caseId)) {
      errors.push(`Unknown or duplicate direct case: ${observation.caseId}`);
      continue;
    }
    seen.add(observation.caseId);
  }
  for (const testCase of cases) {
    const observation = responses.observations.find(row => row.caseId === testCase.id);
    try {
      configured(observation, `Missing required direct response: ${testCase.id}`);
      rows.push(scoredObservation(observation, testCase, versionHash, 'model-evidence'));
    } catch (error) {
      errors.push(`${testCase.id}: ${error.message}`);
    }
  }
  return { rows, errors };
}

function evaluateWorkflow(run, ticket, fixtureId, versionHash, workflowCases = []) {
  const observations = workflowObservations(run, ticket);
  return observations.map(observation => {
    // Reviewer labels are bound to interpreter input, never just a ticket ID.
    const testCase = [...cases, ...workflowCases].find(value => value.agent === observation.agent
      && inputHash(value.input) === inputHash(observation.input));
    const context = observation.agent === 'final-review-writer'
      ? { id: `${fixtureId}:writer`, agent: observation.agent, input: observation.input, gold: {} }
      : testCase;
    configured(context, `No frozen labels for ${observation.agent} input ${inputHash(observation.input)}; label this input before scoring.`);
    const row = scoredObservation(observation, context, versionHash, 'model-evidence');
    row.caseId = `${fixtureId}:${observation.cycle}:${observation.agent}`;
    return row;
  });
}

function runEvaluation({ selfTest = false, responses, baselineResponses, definitions = defaults, coverage = runAudit() } = {}) {
  const versionHash = scorerHash();
  const errors = [];
  let direct = [];
  let directBaseline = [];
  const workflows = [];
  const baseline = [];
  let workflowCases = [];
  configured(definitions.version === 2 && definitions.directCases === 'evals/step-cases.js', 'Unsupported eval definitions.');
  configured(Array.isArray(definitions.fixtures) && definitions.fixtures.length > 0, 'Required workflow fixtures are missing.');
  configured(new Set(definitions.fixtures.map(f => f.fixture)).size === definitions.fixtures.length, 'Duplicate fixture identities.');
  if (!coverage.pass) errors.push('Instruction coverage/sensitivity gate failed.');
  if (selfTest) {
    direct = cases.map(testCase => scoredObservation({
      rawResponse: JSON.stringify(testCase.output)
    }, testCase, versionHash, 'authored-controls'));
  } else {
    if (definitions.workflowLabelsFile) {
      const labels = readJson(path.resolve(root, definitions.workflowLabelsFile));
      configured(Array.isArray(labels.cases), 'Workflow label file must contain frozen cases.');
      workflowCases = labels.cases.map(value => {
        configured(value && !(value.inputFile && Object.hasOwn(value, 'input')),
          'Workflow labels must select one fixed input source.');
        return value.inputFile
          ? { ...value, input: readJson(path.resolve(root, value.inputFile)) }
          : value;
      });
      const identities = new Set(cases.map(value => JSON.stringify([value.agent, inputHash(value.input)])));
      for (const value of workflowCases) {
        configured(value && value.input && typeof value.input === 'object' && !Array.isArray(value.input)
          && value.gold && typeof value.gold === 'object'
          && cases.some(testCase => testCase.agent === value.agent), 'Invalid workflow label context.');
        const identity = JSON.stringify([value.agent, inputHash(value.input)]);
        configured(typeof value.id === 'string' && value.id.trim()
          && typeof value.provenance === 'string' && value.provenance.trim()
          && value.inputHash === inputHash(value.input) && !identities.has(identity),
        'Workflow labels require provenance, fixed input hashes, and unique non-overriding contexts.');
        identities.add(identity);
      }
    }
    if (responses === undefined && definitions.responseFile) {
      try {
        responses = readJson(path.resolve(root, definitions.responseFile));
      } catch (error) {
        errors.push(`Direct response file: ${error.message}`);
      }
    }
    const evaluated = evaluateDirect(responses || { observations: [] }, versionHash);
    direct = evaluated.rows;
    errors.push(...evaluated.errors);
    if (baselineResponses) {
      const evaluatedBaseline = evaluateDirect(baselineResponses, versionHash);
      directBaseline = evaluatedBaseline.rows;
      errors.push(...evaluatedBaseline.errors.map(error => `Baseline direct: ${error}`));
    }
    for (const fixture of definitions.fixtures) {
      const ticket = fs.readFileSync(path.resolve(root, fixture.fixture), 'utf8');
      try {
        const run = readJson(path.resolve(root, fixture.evidenceFile));
        const rows = evaluateWorkflow(run, ticket, fixture.fixture, versionHash, workflowCases);
        workflows.push({ fixture: fixture.fixture, rows });
      } catch (error) {
        errors.push(`${fixture.fixture}: ${error.message}`);
        workflows.push({ fixture: fixture.fixture, rows: [], failure: error.message });
      }
      try {
        const run = readBaseline(fixture.baseline);
        baseline.push(run ? { fixture: fixture.fixture, rows: evaluateWorkflow(run, ticket, fixture.fixture, versionHash, workflowCases) }
          : { fixture: fixture.fixture, rows: [], applicable: false, reason: fixture.baseline.reason });
      } catch (error) {
        errors.push(`Baseline ${fixture.fixture}: ${error.message}`);
        baseline.push({ fixture: fixture.fixture, rows: [], failure: error.message });
      }
    }
  }
  const rows = [...direct, ...workflows.flatMap(value => value.rows)];
  const totals = aggregate(rows.map(row => row.score));
  const failures = rows.filter(row => !row.score.pass).map(row => ({ caseId: row.caseId, agent: row.agent,
    gates: Object.keys(row.score.gates).filter(name => !row.score.gates[name]),
    criteria: Object.keys(row.score.thresholds).filter(name => row.score.thresholds[name].pass === false) }));
  const missingCriteria = Object.keys(THRESHOLDS).filter(name =>
    !Object.values(totals).some(metrics => metrics[name]?.applicable));
  if (missingCriteria.length) errors.push(`Mandatory criteria have no measured cases: ${missingCriteria.join(', ')}`);
  const pass = errors.length === 0 && failures.length === 0
    && Object.values(totals).every(metrics => Object.values(metrics).every(data => data.pass !== false));
  return {
    generatedBy: 'node src/run-evals.js', generatedAt: new Date().toISOString(), scorerVersion: VERSION,
    mode: selfTest ? 'authored-controls' : 'persisted-model-evidence',
    modelPerformanceMeasured: !selfTest && direct.length === cases.length && errors.length === 0,
    methodology: 'Frozen full-proposition labels, contextual review findings, bounded parsed reports; explicit NA, non-compensable gates, unrounded decisions.',
    pass, errors, failures, thresholds: THRESHOLDS, aggregate: totals,
    direct, workflows, baseline,
    comparisons: comparePaired([...directBaseline, ...baseline.flatMap(value => value.rows)], rows),
    coverage: { pass: coverage.pass, modelPerformanceMeasured: false, hashes: coverage.hashes,
      checks: coverage.checks, negativeControls: coverage.negativeControls,
      agents: coverage.agents, errors: coverage.errors },
    hashes: {
      scorer: versionHash,
      definitions: hash(JSON.stringify(definitions)),
      cases: hash(fs.readFileSync(path.join(root, 'evals/step-cases.js'))),
      loadBearingCases: hash(fs.readFileSync(path.join(root, 'evals/load-bearing-cases.js'))),
      responses: responses ? hash(JSON.stringify(responses)) : null,
      baselineResponses: baselineResponses ? hash(JSON.stringify(baselineResponses)) : null,
      workflowLabels: workflowCases.length ? hash(JSON.stringify(workflowCases)) : null
    }
  };
}

function main(argv = process.argv.slice(2)) {
  let output;
  const options = {};
  try {
    for (let i = 0; i < argv.length; i++) {
      const flag = argv[i];
      if (flag === '--self-test') options.selfTest = true;
      else {
        configured(['--responses', '--baseline-responses', '--definitions', '--output'].includes(flag)
          && argv[i + 1] && !argv[i + 1].startsWith('--'), `Unknown flag or missing argument: ${flag}`);
        const value = argv[++i];
        if (flag === '--output') output = value;
        else options[{ '--responses': 'responses', '--baseline-responses': 'baselineResponses', '--definitions': 'definitions' }[flag]] = readJson(value);
      }
    }
    configured(!options.selfTest || (!options.responses && !options.baselineResponses),
      'Authored controls cannot be mixed with model evidence.');
    const result = runEvaluation(options);
    if (output) {
      configured(path.resolve(output) !== path.join(root, 'sub-agents-results.json')
        && !fs.existsSync(output), 'Use a new output file; historical results must not be overwritten.');
      fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
    }
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exitCode = 1;
  } catch (error) {
    process.exitCode = 1;
    console.error(JSON.stringify({ pass: false, status: error.code || 'EVAL_FAILURE', reason: error.message }));
  }
}

module.exports = { runEvaluation, evaluateDirect, evaluateWorkflow, readBaseline, main };
