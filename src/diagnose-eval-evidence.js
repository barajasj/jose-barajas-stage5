const fs = require('fs');
const path = require('path');
const { THRESHOLDS, aggregate } = require('./eval-scorer');
const { hash, readJson, workflowObservations } = require('./eval-evidence');
const { validateReview, validateInterpretationTransition } = require('./governance-policy');
const { reportTemplate, validateReport } = require('./report-contract');
const { root, writeJson } = require('./evidence-package');
const config = require('./config');

function runtimeProblem(observation) {
  try {
    const output = JSON.parse(observation.rawResponse);
    if (observation.agent === 'requirement-interpreter') validateInterpretationTransition(output, observation.input);
    else if (observation.agent === 'adversarial-reviewer') validateReview(output, observation.input);
    else validateReport(output, observation.input);
    return null;
  } catch (error) {
    return { code: error.code || 'INVALID_RESPONSE', reason: error.message };
  }
}

function firstDifference(actual, expected) {
  let offset = 0;
  while (offset < actual.length && offset < expected.length && actual[offset] === expected[offset]) offset++;
  return offset === actual.length && offset === expected.length ? null
    : { offset, actual: actual.slice(Math.max(0, offset - 40), offset + 100),
      expected: expected.slice(Math.max(0, offset - 40), offset + 100) };
}

function diagnose(directory, reportName = 'after-labeled.json') {
  const summary = readJson(path.join(directory, 'collection-summary.json'));
  const report = readJson(path.join(directory, reportName));
  const before = readJson(path.join(directory, 'before.json'));
  const responses = readJson(path.join(directory, 'direct-responses.json'));
  const definitions = readJson(path.join(directory, 'definitions.json'));
  const observations = [...responses.observations];
  for (const fixture of definitions.fixtures) {
    const run = readJson(path.resolve(root, fixture.evidenceFile));
    if (['COMPLETED', 'COMPLETED_AFTER_HUMAN_APPROVAL'].includes(run.status)) {
      observations.push(...workflowObservations(run, fs.readFileSync(path.resolve(root, fixture.fixture), 'utf8')));
    }
  }
  const rows = [...report.direct, ...report.workflows.flatMap(run => run.rows)];
  const rowFailures = report.failures.map(failure => {
    const row = rows.find(value => value.caseId === failure.caseId && value.agent === failure.agent);
    const observation = observations.find(value => value.agent === row.agent
      && hash(JSON.stringify(value.input)) === row.inputHash);
    const attempt = summary.attempts.find(value => value.caseId === failure.caseId);
    const problem = observation ? runtimeProblem(observation) : null;
    const causes = failure.gates.map(gate => ({
      gate,
      reason: gate === 'schemaConformance' ? 'Raw candidate fails required schema; semantic scoring uses invalid output, not repaired JSON.'
        : ['runtimeContract', 'redispatchSafety', 'concernContinuity'].includes(gate) && problem
          ? problem.reason
          : 'Frozen content/reference/continuity assertion failed. Exact-gold mismatch alone does not prove a semantic defect.'
    }));
    return {
      ...failure, runtimeOutcome: attempt?.status || 'SUCCESS',
      runtimeProblem: problem, schemaDetails: attempt?.details || null, causes,
      metricFailures: Object.fromEntries(failure.criteria.map(name => [name, {
        ...row.score.metrics[name], threshold: row.score.thresholds[name].threshold,
        reason: row.score.gates.schemaConformance
          ? 'Applicable fixed-label assertion not satisfied; no keyword or paraphrase credit.'
          : 'Schema-invalid response receives no semantic credit.'
      }])),
      rawArtifact: observation?.provenance.rawArtifact || null
    };
  });
  const errors = report.errors.map(error => {
    const baseline = error.startsWith('Baseline ');
    const workflow = summary.workflows.find(value => error.startsWith(`${value.fixture}:`));
    return {
      error,
      cause: baseline ? 'Historical 4fcbf47 export lacks completed status, cycle manifests, and current contracts. Original bytes preserved; cannot invent missing provenance.'
        : workflow ? `${workflow.status}: ${workflow.reason}`
          : error.includes('No frozen labels') ? 'New upstream input needs independently authored frozen labels.'
            : error.includes('Missing required direct response') ? 'No usable raw observation was collected for this required case.'
              : error.includes('Mandatory criteria') ? 'Required metric has no applicable accepted observations.'
                : 'See referenced evidence/configuration failure.',
      details: workflow?.details || null
    };
  });
  const writerFailures = summary.workflows.filter(value =>
    value.reason === 'Final report violates the supplied artifact content contract.').map(value => {
    const base = path.join(directory, 'runs', value.correlationId, 'cycle-1', 'final-review-writer');
    const input = readJson(`${base}-input.json`);
    const output = JSON.parse(fs.readFileSync(`${base}-raw.txt`, 'utf8'));
    const actual = output.reportMarkdown.replace(/\r\n/g, '\n').trim();
    const expected = reportTemplate(input);
    return { fixture: value.fixture, cause: value.reason, difference: firstDifference(actual, expected) };
  });
  const receipts = fs.readdirSync(path.join(directory, 'receipts')).map(file =>
    readJson(path.join(directory, 'receipts', file)));
  const tokens = receipts.reduce((total, receipt) => ({
    prompt: total.prompt + (receipt.promptTokens || 0),
    completion: total.completion + (receipt.completionTokens || 0),
    total: total.total + (receipt.totalTokens || 0)
  }), { prompt: 0, completion: 0, total: 0 });
  const directMetrics = aggregate(report.direct.map(row => row.score));
  const measured = Object.keys(THRESHOLDS).filter(name =>
    Object.values(directMetrics).some(metrics => metrics[name]?.applicable));
  return {
    generatedAt: new Date().toISOString(), status: report.pass ? 'PASS' : 'BLOCKED',
    scope: 'One authorized batch; all attempts included, no prompt changes or live reruns.',
    before: { pass: before.pass, directCases: before.direct.length, errors: before.errors.length,
      failures: before.failures.length, aggregate: before.aggregate },
    after: { pass: report.pass, directCases: report.direct.length,
      directPasses: report.direct.filter(row => row.score.pass).length,
      directRuntimeSuccesses: summary.directRuntimeSuccesses, workflowCompletions: summary.workflowCompletions,
      workflowAttempts: summary.workflows.length, errors: report.errors.length, failures: report.failures.length },
    mandatoryMetricTypes: { measured: measured.length, required: Object.keys(THRESHOLDS).length, names: measured },
    directOnlyMetrics: directMetrics, errors, rowFailures, writerFailures,
    usage: { modelInvocations: summary.modelInvocations, tokens, pricing: config.pricing,
      estimatedUSD: (tokens.prompt * config.pricing.inputPerMillion
        + tokens.completion * config.pricing.outputPerMillion) / 1_000_000 },
    qualifications: [
      'Pooled writer metrics include only two direct cases and the completed ticket-1 workflow. Two failed workflow writers are not evidence of preservation success.',
      'Positive-control interpreter invented out-of-scope questions; that workflow did not demonstrate clean PASS.',
      'Ticket-1 interpreter asserted a read-only restriction not required by the source ticket.',
      'Post-collection ticket-1 reviewer labels use frozen upstream input and source review, not candidate review wording.',
      'No valid historical/current paired comparison or two measured prompt-change cycles per agent.',
      'modelPerformanceMeasured=false on the overall evaluator reflects remaining evidence errors, not absence of these 26 real direct responses.'
    ]
  };
}

if (require.main === module) {
  try {
    const directory = path.resolve(process.argv[2]);
    const result = diagnose(directory);
    writeJson(path.join(directory, 'diagnostics.json'), result);
    console.log(JSON.stringify({ status: result.status, before: result.before, after: result.after,
      mandatoryMetricTypes: result.mandatoryMetricTypes, usage: result.usage }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: 'DIAGNOSTIC_FAILURE', reason: error.message }));
    process.exitCode = 1;
  }
}

module.exports = { diagnose, firstDifference };
