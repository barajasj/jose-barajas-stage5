const { deriveDisposition, requireContract } = require('./governance-policy');

function reportTemplate(input) {
  const { interpreterResult, reviewResult, disposition, reasonCodes } = input;
  requireContract(reviewResult.status === (reviewResult.findings.length ? 'FAIL' : 'PASS'),
    'Report requires a status-consistent review.');
  requireContract(interpreterResult.ambiguities.every((_, i) =>
    reviewResult.findings.some(f => f.kind === 'OPEN_AMBIGUITY'
      && f.ambiguityRefs.includes(`/ambiguities/${i}`))
  ), 'Report requires reviewer coverage of all open ambiguities.');
  const expected = deriveDisposition(interpreterResult, reviewResult);
  requireContract(disposition === expected.disposition
    && JSON.stringify(reasonCodes) === JSON.stringify(expected.reasonCodes),
  'Report disposition and reasons must match the governance policy.');
  const findings = reviewResult.findings.map(f =>
    `- ${f.id} | ${f.severity} | ${f.kind} | ${JSON.stringify(f.description)} | ${JSON.stringify(f.action)}`
  );
  const ambiguities = interpreterResult.ambiguities.map((item, i) =>
    `- /ambiguities/${i} | ${JSON.stringify(item)}`
  );
  return [
    `# ${disposition}`,
    '## Requirement Summary',
    JSON.stringify(interpreterResult.requirementSummary),
    '## Reviewer Findings',
    findings.join('\n') || 'None.',
    '## Open Ambiguities',
    ambiguities.join('\n') || 'None.',
    '## Final Disposition',
    disposition,
    '## Governance Reasons',
    reasonCodes.map(code => `- ${code}`).join('\n')
  ].join('\n\n');
}

function validateReport(output, input) {
  const normalized = (output.reportMarkdown || '').replace(/\r\n/g, '\n').trim();
  requireContract(normalized === reportTemplate(input),
    'Final report violates the supplied artifact content contract.');
}

module.exports = { reportTemplate, validateReport };
