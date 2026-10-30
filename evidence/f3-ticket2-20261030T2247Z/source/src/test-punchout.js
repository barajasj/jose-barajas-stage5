/*
Active punch-out test suite for the coordinator's
human escalation gate.

Each scenario executes the real coordinator in mock
runtime mode against a controlled substance assessment
(human review required) and a controlled human
decisions file, then asserts the coordinator's
returned disposition and that the final-review-writer
was or was not dispatched.

Run:
  node src/test-punchout.js
*/

const fs = require('fs');
const path = require('path');

const { executeWorkflow } = require('./coordinator');

const TMP_DIR = path.join(
  'runs', 'punchout-tests'
);

const ASSESSMENT_FILE = path.join(
  TMP_DIR,
  'assessment-human-required.json'
);

const TICKET = [
  '# Test Ticket',
  '',
  'Calculate the DX Coil Height as the sum',
  'of all Cooling Circuit Heights.'
].join('\n');

function writeDecisionsFile(name, records) {
  const filePath = path.join(
    TMP_DIR, name
  );

  if (records === null) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return filePath;
  }

  fs.writeFileSync(
    filePath,
    records.map(r => JSON.stringify(r)).join('\n')
      + (records.length ? '\n' : ''),
    'utf8'
  );
  return filePath;
}

function decision(overrides = {}) {
  return {
    timestamp: new Date().toISOString(),
    reviewer: 'Test Reviewer',
    decision: 'CONTINUE',
    reason: 'Approved for test purposes.',
    ...overrides
  };
}

const NOW = Date.now();

const scenarios = [
  {
    id: 'S1-silence-no-decision',
    description:
      'Human review required but no decision recorded; '
      + 'coordinator must halt (PUNCH_OUT) and must not '
      + 'dispatch the final-review-writer.',
    decisionsRecords: null,
    options: {},
    expect: {
      status: 'PUNCH_OUT',
      noFinalReport: true
    }
  },
  {
    id: 'S2-explicit-reject',
    description:
      'Human decision REJECT; coordinator must return '
      + 'REJECTED_BY_HUMAN and must not dispatch the '
      + 'final-review-writer.',
    decisionsRecords: [
      decision({
        decision: 'REJECT',
        reason:
          'Business review rejected continuation.'
      })
    ],
    options: {},
    expect: {
      status: 'REJECTED_BY_HUMAN',
      noFinalReport: true
    }
  },
  {
    id: 'S3-explicit-continue',
    description:
      'Human decision CONTINUE with reviewer and '
      + 'reason; coordinator must log governance '
      + 'reasoning and complete the workflow.',
    decisionsRecords: [
      decision({ decision: 'CONTINUE' })
    ],
    options: {},
    expect: {
      status: 'COMPLETED_AFTER_HUMAN_APPROVAL',
      noFinalReport: false,
      humanGovernance: 'HUMAN_APPROVED_CONTINUE'
    }
  },
  {
    id: 'S4-explicit-approve',
    description:
      'Human decision APPROVE with reviewer and '
      + 'reason; coordinator must log governance '
      + 'reasoning and complete the workflow.',
    decisionsRecords: [
      decision({ decision: 'APPROVE' })
    ],
    options: {},
    expect: {
      status: 'COMPLETED_AFTER_HUMAN_APPROVAL',
      noFinalReport: false,
      humanGovernance: 'HUMAN_APPROVED_CONTINUE'
    }
  },
  {
    id: 'S5-bypass-unknown-value',
    description:
      'Bypass attempt: decision value "AUTO-APPROVE" '
      + 'is not an allowed value; coordinator must '
      + 'fail closed (PUNCH_OUT) instead of falling '
      + 'through to implicit approval.',
    decisionsRecords: [
      decision({ decision: 'AUTO-APPROVE' })
    ],
    options: {},
    expect: {
      status: 'PUNCH_OUT',
      noFinalReport: true
    }
  },
  {
    id: 'S6-bypass-missing-reason',
    description:
      'Bypass attempt: APPROVE without a documented '
      + 'reason; coordinator must fail closed '
      + '(PUNCH_OUT) because approvals require '
      + 'recorded reasoning.',
    decisionsRecords: [
      decision({ decision: 'APPROVE', reason: '' })
    ],
    options: {},
    expect: {
      status: 'PUNCH_OUT',
      noFinalReport: true
    }
  },
  {
    id: 'S7-timeout-stale-decision',
    description:
      'Human decision exists but is older than the '
      + 'allowed decision age; coordinator must treat '
      + 'it as timed out and halt (PUNCH_OUT).',
    decisionsRecords: [
      decision({
        decision: 'CONTINUE',
        timestamp: new Date(
          NOW - 1000 * 60 * 60 * 24 * 90
        ).toISOString()
      })
    ],
    options: {
      humanDecisionMaxAgeMs: 1000 * 60 * 60 * 24
    },
    expect: {
      status: 'PUNCH_OUT',
      noFinalReport: true
    }
  },
  {
    id: 'S8-fresh-decision-honored',
    description:
      'Human decision within the allowed age is '
      + 'honored; coordinator completes after '
      + 'explicit approval.',
    decisionsRecords: [
      decision({
        decision: 'CONTINUE',
        timestamp: new Date(
          NOW - 1000 * 60 * 60
        ).toISOString()
      })
    ],
    options: {
      humanDecisionMaxAgeMs: 1000 * 60 * 60 * 24
    },
    expect: {
      status: 'COMPLETED_AFTER_HUMAN_APPROVAL',
      noFinalReport: false,
      humanGovernance: 'HUMAN_APPROVED_CONTINUE'
    }
  }
];

async function runScenario(scenario) {

  const decisionsFile = writeDecisionsFile(
    `${scenario.id}.jsonl`,
    scenario.decisionsRecords
  );

  const result = await executeWorkflow(TICKET, {
    assessmentFile: ASSESSMENT_FILE,
    decisionsFile,
    ...scenario.options
  });

  const checks = [];
  const failed = [];

  const check = (name, actual, expected) => {
    const pass = actual === expected;
    checks.push({
      name, expected, actual, pass
    });
    if (!pass) failed.push(name);
  };

  check(
    'status',
    result.status,
    scenario.expect.status
  );

  check(
    'finalReviewWriterDispatched',
    Boolean(result.finalReport),
    !scenario.expect.noFinalReport
  );

  if (scenario.expect.humanGovernance) {
    check(
      'humanGovernance.status',
      result.humanGovernance?.status,
      scenario.expect.humanGovernance
    );
  }

  return {
    id: scenario.id,
    description: scenario.description,
    expectedStatus: scenario.expect.status,
    actualStatus: result.status,
    checks,
    pass: failed.length === 0,
    failedChecks: failed
  };
}

async function main() {

  fs.mkdirSync(TMP_DIR, { recursive: true });

  fs.writeFileSync(
    ASSESSMENT_FILE,
    JSON.stringify({
      systemName: 'punchout-test',
      workflows: [
        {
          name: 'test-workflow',
          classification: 'TOY'
        }
      ],
      overallAssessment: {
        humanReviewRequired: true
      }
    }, null, 2) + '\n',
    'utf8'
  );

  const results = [];

  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }

  const passed = results.filter(r => r.pass).length;
  const summary = {
    generatedAt: new Date().toISOString(),
    runtimeMode:
      process.env.RUNTIME_MODE || 'mock',
    total: results.length,
    passed,
    failed: results.length - passed,
    scenarios: results
  };

  const outPath = path.join(
    'runs', 'punchout-test-results.json'
  );

  fs.writeFileSync(
    outPath,
    JSON.stringify(summary, null, 2) + '\n',
    'utf8'
  );

  results.forEach(r => {
    console.log(
      `${r.pass ? 'PASS' : 'FAIL'}  `
      + `${r.id}  ->  ${r.actualStatus}`
    );
  });

  console.log(
    `\n${passed}/${results.length} `
    + 'scenarios passed. Results: '
    + outPath
  );

  if (passed !== results.length) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
