function contractError(message, code = 'GOVERNANCE_FAILURE') {
  return Object.assign(new Error(message), { code });
}

function requireContract(condition, message) {
  if (!condition) {
    throw contractError(message);
  }
}

function nonblank(value) {
  return typeof value === 'string' && Boolean(value.trim());
}

function validateSources(refs, input) {
  requireContract(Array.isArray(refs) && refs.length > 0, 'Source references are required.');
  for (const ref of refs) {
    let value = input.ticket;
    if (ref.artifact === 'interpreter') {
      requireContract(typeof ref.pointer === 'string' && ref.pointer.startsWith('/'),
        'Interpreter source requires a JSON pointer.');
      value = input.interpreterResult;
      for (const part of ref.pointer.slice(1).split('/')) {
        const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
        requireContract(value !== null && typeof value === 'object'
          && Object.hasOwn(value, key), 'Source pointer does not exist.');
        value = value[key];
      }
    } else {
      requireContract(ref.artifact === 'ticket' && ref.pointer === '',
        'Source must reference the ticket or current interpreter.');
    }
    requireContract(nonblank(ref.quote) && typeof value === 'string'
      && value.includes(ref.quote), 'Source quote is not present in the referenced artifact.');
  }
}

function validateInterpretationTransition(output, input) {
  requireContract(Array.isArray(output.ambiguities)
    && output.ambiguities.every(nonblank), 'Interpreter ambiguities must be nonblank strings.');
  const previous = input.previousInterpretation?.ambiguities || [];
  const resolutions = output.ambiguityResolutions || [];
  const removed = previous.filter(item => !output.ambiguities.includes(item));
  requireContract(new Set(resolutions.map(r => r.ambiguity)).size === resolutions.length,
    'Duplicate ambiguity resolutions.');
  for (const resolution of resolutions) {
    requireContract(removed.includes(resolution.ambiguity) && nonblank(resolution.rationale),
      'Ambiguity resolution must identify a removed prior ambiguity and explain the correction.');
    requireContract(nonblank(resolution.sourceQuote) && input.ticket.includes(resolution.sourceQuote),
      'Ambiguity resolution source must be present in the original ticket.');
  }
  requireContract(removed.every(item => resolutions.some(r => r.ambiguity === item)),
    'Redispatch removed an ambiguity without a sourced resolution.');
}

function validateReview(output, input) {
  requireContract(['PASS', 'FAIL'].includes(output.status) && Array.isArray(output.findings),
    'Reviewer status or findings are invalid.');
  requireContract(output.status === (output.findings.length ? 'FAIL' : 'PASS'),
    'Reviewer status contradicts findings.');
  requireContract(nonblank(output.rationale), 'Reviewer rationale is required.');
  const ambiguities = input.interpreterResult.ambiguities;
  requireContract(Array.isArray(ambiguities), 'Interpreter ambiguities are required.');
  const ids = new Set();
  const covered = new Set();
  for (const finding of output.findings) {
    requireContract(nonblank(finding.id) && !ids.has(finding.id), 'Duplicate or missing finding ID.');
    ids.add(finding.id);
    requireContract(['LOW', 'MEDIUM', 'HIGH'].includes(finding.severity)
      && nonblank(finding.description) && nonblank(finding.action),
    'Finding severity, description, and action are required.');
    validateSources(finding.sourceRefs, input);
    requireContract(Array.isArray(finding.ambiguityRefs), 'Finding ambiguity references are required.');
    for (const pointer of finding.ambiguityRefs) {
      const match = /^\/ambiguities\/(0|[1-9]\d*)$/.exec(pointer);
      requireContract(match && Number(match[1]) < ambiguities.length,
        'Finding references an unknown ambiguity.');
      requireContract(finding.kind === 'OPEN_AMBIGUITY'
        && finding.sourceRefs.some(ref => ref.artifact === 'interpreter'
          && ref.pointer === pointer && ref.quote === ambiguities[Number(match[1])]),
      'Open ambiguity must have an exact interpreter source reference.');
      covered.add(pointer);
    }
    requireContract(finding.kind !== 'OPEN_AMBIGUITY' || finding.ambiguityRefs.length > 0,
      'Open ambiguity finding must identify its ambiguity.');
  }
  requireContract(ambiguities.every((_, i) => covered.has(`/ambiguities/${i}`)),
    'Reviewer did not cover every unresolved interpreter ambiguity.');
  const resolutions = output.resolutions;
  requireContract(Array.isArray(resolutions), 'Reviewer resolutions are required.');
  const previous = input.previousReview?.findings || [];
  const resolvedIds = new Set();
  for (const resolution of resolutions) {
    requireContract(previous.some(f => f.id === resolution.findingId)
      && !ids.has(resolution.findingId) && !resolvedIds.has(resolution.findingId)
      && nonblank(resolution.rationale), 'Invalid or duplicate prior finding resolution.');
    validateSources(resolution.sourceRefs, input);
    resolvedIds.add(resolution.findingId);
  }
  requireContract(previous.every(f => ids.has(f.id) || resolvedIds.has(f.id)),
    'Prior findings disappeared without sourced resolutions.');
}

function deriveDisposition(interpreter, review) {
  requireContract(Array.isArray(interpreter.ambiguities) && Array.isArray(review.findings),
    'Disposition requires validated interpreter and reviewer artifacts.');
  const reasonCodes = [];
  if (review.findings.length) {
    reasonCodes.push('OPEN_FINDINGS');
  }
  if (interpreter.ambiguities.length) {
    reasonCodes.push('OPEN_AMBIGUITIES');
  }
  return {
    disposition: reasonCodes.length ? 'FAIL' : 'PASS',
    reasonCodes: reasonCodes.length ? reasonCodes : ['NO_OPEN_CONCERNS']
  };
}

module.exports = {
  contractError,
  requireContract,
  validateInterpretationTransition,
  validateReview,
  deriveDisposition
};
