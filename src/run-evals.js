/*
Evaluates persisted workflow artifacts against the
test case definitions in evals/test-cases.json and
writes measured results to sub-agents-results.json.

- Final scores:       evidence/ticketN-run.json
- Iteration baseline: evidence/run1/ticketN-run.json
                      as committed at 4fcbf47 (the
                      earlier live runs).

Run:
  node src/run-evals.js
*/

const fs = require('fs');
const { execSync } = require('child_process');

const testCases = require('../evals/test-cases.json');

const {
  scoreInterpreter,
  scoreReviewer,
  scoreWriter
} = require('./eval-scorer');

const BASELINE_REF = '4fcbf47';

function readJson(file) {
  return JSON.parse(
    fs.readFileSync(file, 'utf8')
  );
}

function readBaseline(file) {
  try {
    return JSON.parse(
      execSync(`git show ${BASELINE_REF}:${file}`, {
        encoding: 'utf8'
      })
    );
  } catch (error) {
    return null;
  }
}

function scoreRun(run, expected) {
  const interpreterOutput =
    run.finalInterpreterResult?.output
    || run.interpreterResult?.output
    || {};
  const reviewOutput =
    run.finalReviewResult?.output
    || run.reviewResult?.output
    || { status: 'PASS', findings: [] };
  const reportOutput =
    run.finalReport?.output || {};
  const disposition =
    run.disposition || reviewOutput.status;

  return {
    requirementInterpreter:
      scoreInterpreter(
        interpreterOutput,
        expected.requirementInterpreter
      ),
    adversarialReviewer:
      scoreReviewer(
        reviewOutput,
        expected.adversarialReviewer
      ),
    finalReviewWriter:
      scoreWriter(
        reportOutput,
        reviewOutput,
        disposition
      )
  };
}

const CRITERIA = {
  requirementInterpreter: [
    'requirementExtractionAccuracy',
    'hvacTerminologyRecognition',
    'ambiguityDetection'
  ],
  adversarialReviewer: [
    'unsupportedAssumptionDetection',
    'missingRequirementDetection',
    'challengeQuality'
  ],
  finalReviewWriter: [
    'findingPreservation',
    'reportCompleteness',
    'outputQuality'
  ]
};

const THRESHOLDS = {
  requirementExtractionAccuracy: 0.90,
  hvacTerminologyRecognition: 0.90,
  ambiguityDetection: 0.80,
  unsupportedAssumptionDetection: 0.85,
  missingRequirementDetection: 0.85,
  challengeQuality: 0.90,
  findingPreservation: 1.00,
  reportCompleteness: 1.00,
  outputQuality: 0.95
};

function aggregate(scoredRuns) {
  const result = {};
  for (const [agent, criteria] of
    Object.entries(CRITERIA)) {
    result[agent] = {};
    for (const criterion of criteria) {
      let matched = 0;
      let total = 0;
      for (const run of scoredRuns) {
        const c = run[agent][criterion];
        matched += c.matched;
        total += c.total;
      }
      result[agent][criterion] = {
        score: total ? matched / total : 1,
        matched,
        total
      };
    }
  }
  return result;
}

function flattenScores(agg) {
  const flat = {};
  for (const [agent, criteria] of
    Object.entries(agg)) {
    flat[agent] = {};
    for (const [criterion, data] of
      Object.entries(criteria)) {
      flat[agent][criterion] =
        Number(data.score.toFixed(3));
    }
  }
  return flat;
}

function main() {

  const perFixture = [];
  const baselinePerFixture = [];

  for (const tc of testCases.fixtures) {
    const run = readJson(tc.evidenceFile);
    const scored = scoreRun(run, tc);

    const baseline = tc.baselineEvidenceFile
      ? readBaseline(tc.baselineEvidenceFile)
      : null;
    const baselineScored = baseline
      ? scoreRun(baseline, tc)
      : null;

    perFixture.push({
      fixture: tc.fixture,
      correlationId: run.correlationId,
      disposition: run.disposition,
      scores: scored
    });

    baselinePerFixture.push({
      fixture: tc.fixture,
      correlationId:
        baseline?.correlationId || null,
      scores: baselineScored
    });
  }

  const finalAgg = aggregate(
    perFixture.map(f => f.scores)
  );

  const baselineRuns = baselinePerFixture
    .filter(f => f.scores)
    .map(f => f.scores);
  const baselineAgg = baselineRuns.length
    ? aggregate(baselineRuns)
    : null;

  const iterations = {};
  if (baselineAgg) {
    for (const [agent, criteria] of
      Object.entries(CRITERIA)) {
      iterations[agent] = {};
      for (const criterion of criteria) {
        const base =
          baselineAgg[agent][criterion].score;
        const final =
          finalAgg[agent][criterion].score;
        iterations[agent][criterion] = {
          baselineScore: Number(
            base.toFixed(3)
          ),
          finalScore: Number(
            final.toFixed(3)
          ),
          delta: Number(
            (final - base).toFixed(3)
          )
        };
      }
    }
  }

  const passFail = {};
  for (const [agent, criteria] of
    Object.entries(flattenScores(finalAgg))) {
    passFail[agent] = {};
    for (const [criterion, score] of
      Object.entries(criteria)) {
      passFail[agent][criterion] = {
        score,
        threshold: THRESHOLDS[criterion],
        pass: score >= THRESHOLDS[criterion]
      };
    }
  }

  const output = {
    generatedBy: 'node src/run-evals.js',
    generatedAt: new Date().toISOString(),
    methodology:
      'Each expected item in evals/test-cases.json '
      + 'is scored 1 when any keyword in its anyOf '
      + 'list appears (case-insensitive substring) '
      + 'in the relevant output field of the '
      + 'persisted run artifact, else 0. Criterion '
      + 'score = matched items / total items. '
      + 'Aggregate = pooled matched/total across '
      + 'all four fixtures. Baseline = same scorer '
      + 'applied to the earlier committed run '
      + `artifacts (${BASELINE_REF}).`,
    ...flattenScores(finalAgg),
    criterionDetail: passFail,
    iterations: {
      baselineRef: BASELINE_REF,
      note:
        'Ticket 4 was added after the baseline '
        + 'run and contributes to final scores '
        + 'only.',
      measured: iterations
    },
    perFixture,
    baselinePerFixture,
    testArtifacts: {
      fixtures: [
        'fixtures/hvac-ticket-1.md',
        'fixtures/hvac-ticket-2.md',
        'fixtures/hvac-ticket-3.md',
        'fixtures/hvac-ticket-4.md'
      ],
      testCaseDefinitions:
        'evals/test-cases.json',
      scorer: 'src/eval-scorer.js',
      coverage: {
        requirementInterpreter: 'direct',
        adversarialReviewer: 'direct',
        finalReviewWriter:
          'indirect via upstream workflow outputs'
      }
    }
  };

  fs.writeFileSync(
    'sub-agents-results.json',
    JSON.stringify(output, null, 2) + '\n',
    'utf8'
  );

  console.log(
    JSON.stringify(
      flattenScores(finalAgg),
      null,
      2
    )
  );
  console.log(
    'Results written to sub-agents-results.json'
  );
}

main();
