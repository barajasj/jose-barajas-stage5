const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { analyzePackage } = require('../../src/f6-analysis');
const { root, relative, writeJson } = require('../../src/evidence-package');
const { hash, readJson } = require('../../src/eval-evidence');

const directory = __dirname;
const location = relative(directory);
const percent = value => value === null ? 'NA' : `${(value * 100).toFixed(1)}%`;
const delta = value => value === null ? 'NA' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)} pp`;
const link = file => `[${file}](${file})`;

function main() {
  if (process.argv[2] !== '--write') throw new Error('Use --write once, after the collection report exists.');
  const result = analyzePackage(directory);
  const saved = readJson(path.join(directory, 'measured-results.json'));
  if (JSON.stringify(result) !== JSON.stringify(saved)) throw new Error('Replay differs from preserved measurements.');
  const plan = readJson(path.join(directory, 'collection-plan.json'));
  const attempts = result.versions.flatMap(version =>
    readJson(path.join(directory, version.version, 'attempts.json')).attempts.map(attempt => {
      const measured = version.rows.find(row => row.caseId === attempt.caseId);
      return { ...attempt, strictPass: measured.score.pass, score: measured.score,
        rawArtifact: measured.rawArtifact, promptTemplateHash: measured.promptTemplateHash };
    }));
  const receipts = plan.versions.flatMap(version =>
    fs.readdirSync(path.join(directory, version.version, 'receipts'))
      .filter(file => file.endsWith('-finished.json'))
      .map(file => readJson(path.join(directory, version.version, 'receipts', file))));
  const tokens = receipts.reduce((total, row) => ({
    prompt: total.prompt + (row.promptTokens || 0),
    completion: total.completion + (row.completionTokens || 0),
    total: total.total + (row.totalTokens || 0)
  }), { prompt: 0, completion: 0, total: 0 });
  const all = {
    actualInvocations: receipts.length, plannedLimit: plan.maxModelInvocations,
    returnedResponses: receipts.filter(row => row.status === 'RESPONSE_RECEIVED').length,
    runtimeAccepted: attempts.filter(row => row.status === 'SUCCESS').length,
    runtimeRejected: attempts.filter(row => row.status !== 'SUCCESS').length,
    strictPasses: attempts.filter(row => row.strictPass).length,
    strictFailures: attempts.filter(row => !row.strictPass).length,
    retries: 0, tokens, attempts,
    qualification: 'Every planned attempt is included. Runtime acceptance is not strict semantic acceptance; failed raw generations are scored, not repaired.'
  };
  writeJson(path.join(directory, 'all-attempts.json'), all);
  writeJson(path.join(directory, 'baseline-comparison.json'), {
    scorerVersion: result.scorerVersion, scorerHash: result.scorerHash,
    archivalExclusions: result.archival,
    eligibleBaselines: result.versions.slice(0, -1).map(version => ({
      version: version.version, responseFile: `${location}/${version.version}/direct-responses.json`,
      rows: version.rows.map(({ score, ...identity }) => identity)
    })),
    cycles: result.cycles.map(cycle => ({
      before: cycle.before, after: cycle.after,
      pairs: cycle.comparison.pairs, unmatched: cycle.unmatched,
      baselineOnly: cycle.comparison.baselineOnly
    }))
  });
  const ledger = plan.agents.map(agent => ({
    agent,
    versions: plan.versions.map((version, index) => ({
      version: version.version, reason: version.reason, addedInstructions: version.changes[agent] || [],
      template: version.prompts[agent],
      baseline: index ? plan.versions[index - 1].version : null,
      measuredOutcome: result.versions[index].agents[agent],
      measuredDelta: index ? result.cycles[index - 1].agents[agent] : null,
      evidence: `${location}/${version.version}/attempts.json`
    }))
  }));
  writeJson(path.join(directory, 'prompt-evolution-ledger.json'), ledger);
  const csv = ['agent,cycle,attempts,baseline_strict_passes,current_strict_passes,strict_pass_delta,baseline_runtime_accepted,current_runtime_accepted,runtime_acceptance_delta'];
  for (const cycle of result.cycles) {
    for (const [agent, row] of Object.entries(cycle.agents)) {
      csv.push([agent, `${cycle.before}->${cycle.after}`, row.current.attempts,
        row.baseline.strictPasses, row.current.strictPasses, row.strictPassDelta,
        row.baseline.runtimeAccepted, row.current.runtimeAccepted, row.runtimeAcceptanceDelta].join(','));
    }
  }
  fs.writeFileSync(path.join(directory, 'improvement-table.csv'), csv.join('\n') + '\n', { flag: 'wx' });
  fs.mkdirSync(path.join(directory, 'prompt-diffs'));
  for (let i = 1; i < plan.versions.length; i++) {
    for (const agent of plan.agents) {
      const before = plan.versions[i - 1];
      const after = plan.versions[i];
      const diff = spawnSync('git', ['diff', '--no-index', '--',
        before.prompts[agent].file, after.prompts[agent].file], { cwd: root, encoding: 'utf8' });
      if (diff.status !== 1 || !diff.stdout) throw new Error('A measured prompt cycle has no reproducible diff.');
      fs.writeFileSync(path.join(directory, 'prompt-diffs', `${agent}-${before.version}-${after.version}.patch`),
        diff.stdout, { flag: 'wx' });
    }
  }
  const lines = [
    '# F6 Measured Results Summary',
    '',
    `Actual calls: ${all.actualInvocations}/${all.plannedLimit}; responses: ${all.returnedResponses}; runtime accepted/rejected: ${all.runtimeAccepted}/${all.runtimeRejected}; strict passes/failures: ${all.strictPasses}/${all.strictFailures}. No retries or repairs.`,
    `Provider-reported tokens: ${tokens.prompt} prompt + ${tokens.completion} completion = ${tokens.total} total.`,
    `Measurement integrity: ${result.measurementPass ? 'PASS' : 'FAIL'}; latest-candidate strict acceptance: ${result.modelAcceptancePass ? 'PASS' : 'FAIL'}.`,
    '',
    `Baseline exclusions, eligible identities, unmatched cases and paired deltas: ${link('baseline-comparison.json')}.`,
    `Full before/after table: ${link('improvement-table.csv')}. Machine ledger: ${link('prompt-evolution-ledger.json')}. All attempts: ${link('all-attempts.json')}.`,
    '',
    '## Per-Agent Results',
    '',
    '| Agent | v0 Strict / Runtime | v1 Strict / Runtime | v2 Strict / Runtime |',
    '|---|---|---|---|'
  ];
  for (const agent of plan.agents) lines.push(`| ${agent} | ${result.versions.map(version => {
    const row = version.agents[agent];
    return `${row.strictPasses}/${row.attempts} / ${row.runtimeAccepted}/${row.attempts}`;
  }).join(' | ')} |`);
  for (const agent of plan.agents) {
    lines.push('', `### ${agent}`, '',
      '| Criterion | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |', '|---|---:|---:|---:|---:|---:|');
    const summaries = result.versions.map(version => version.agents[agent]);
    for (const name of Object.keys(summaries[0].metrics)) lines.push(
      `| ${name} | ${summaries.map(row => percent(row.metrics[name].score)).join(' | ')} | ${result.cycles.map(cycle => delta(cycle.agents[agent].metrics[name].delta)).join(' | ')} |`);
    lines.push('', '| Non-Compensable Gate | v0 | v1 | v2 | Cycle 1 Delta | Cycle 2 Delta |',
      '|---|---:|---:|---:|---:|---:|');
    for (const name of Object.keys(summaries[0].gates)) lines.push(
      `| ${name} | ${summaries.map(row => percent(row.gates[name])).join(' | ')} | ${result.cycles.map(cycle => delta(cycle.agents[agent].gates[name].delta)).join(' | ')} |`);
  }
  lines.push('', '## Runtime Rejections', '',
    '| Version | Case | Rejection | Attempt Evidence |', '|---|---|---|---|');
  for (const attempt of attempts.filter(row => row.status !== 'SUCCESS')) {
    lines.push(`| ${attempt.version} | ${attempt.caseId} | ${attempt.status}: ${attempt.reason.replace(/\|/g, '/')} | ${link(`${attempt.version}/${attempt.caseId}-attempt.json`)} |`);
  }
  lines.push('', '## Complete Case Index', '',
    'Cells show runtime result / strict result, linking to every attempt, not just successes.',
    '', '| Case | v0 | v1 | v2 |', '|---|---|---|---|');
  for (const row of result.versions[0].rows) lines.push(`| ${row.caseId} | ${plan.versions.map(version => {
    const attempt = attempts.find(item => item.version === version.version && item.caseId === row.caseId);
    return `[${attempt.status} / ${attempt.strictPass ? 'PASS' : 'FAIL'}](${version.version}/${row.caseId}-attempt.json)`;
  }).join(' | ')} |`);
  lines.push('', '## Interpretation And Limits', '',
    '- The corrected bounded scorer and labels are unchanged. Strict-label failures are not automatically semantic error estimates.',
    '- Positive and negative deltas are descriptive observations on this small development suite, not causal or statistical proof.',
    '- v0 is a newly collected baseline; no historical export was upgraded or relabeled as a compatible run.',
    '- Candidates were genuinely changed and measured twice per agent. A measured cycle is not necessarily a successful improvement.',
    '- No production prompts are promoted; no additional workflows or remediation streams were started.',
    '- The full evaluator snapshots retain old Deliverable 5 workflow failures. They are not new F3 workflow attempts or evidence that the completed F3 remediation regressed.',
    '- preflight.json, interim-v0.json, and interim-v1.json are retained intermediate snapshots, not final acceptance reports.',
    '', '## Reproduction', '', '```text',
    `node src/run-f6.js ${location}`,
    `node src/evidence-package.js ${location}`,
    'npm test', 'npm run eval:controls', 'npm run eval:coverage', '```', '',
    `Pinned measurement identity: ${result.scorerVersion}, SHA-256 ${result.scorerHash}.`,
    `The collection source snapshot and original plan are preserved; finalized documentation is added separately without overwriting them.`,
    ''
  );
  fs.writeFileSync(path.join(directory, 'MEASURED-SUMMARY.md'), lines.join('\n'), { flag: 'wx' });
  console.log(JSON.stringify({ invocations: all.actualInvocations, tokens, summaryHash: hash(lines.join('\n')) }, null, 2));
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
