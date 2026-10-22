/*
Deterministic per-step evaluators.

Each expected item in evals/test-cases.json is matched
when ANY keyword in `anyOf` appears as a
case-insensitive substring of the relevant output
field. Scores are matched/total fractions, so every
reported percentage is directly reproducible from the
persisted artifacts.
*/

const ALLOWED_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH'
];

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with',
  'from', 'which', 'are', 'not', 'does', 'but',
  'when', 'into', 'must', 'have', 'has', 'been',
  'would', 'should', 'could', 'their', 'they',
  'them', 'will', 'shall', 'each', 'any', 'all'
]);

function significantWords(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOP_WORDS.has(w));
}

function matchExpectation(haystack, expectation) {
  const text = (haystack || '').toLowerCase();
  const anyOf = expectation.anyOf || [];
  return anyOf.some(k =>
    text.includes(k.toLowerCase())
  );
}

function scoreExpectedItems(expectedItems, text) {
  const items = (expectedItems || []).map(item => ({
    id: item.id,
    expectation: item.expectation,
    matched: matchExpectation(text, item)
  }));
  const matched = items.filter(i => i.matched).length;
  return {
    score: items.length ? matched / items.length : 1,
    matched,
    total: items.length,
    items
  };
}

function scoreTermList(expectedTerms, actualTerms) {
  const haystack = (actualTerms || [])
    .join(' ')
    .toLowerCase();
  const matched = (expectedTerms || []).filter(
    term => haystack.includes(term.toLowerCase())
  );
  return {
    score: expectedTerms?.length
      ? matched.length / expectedTerms.length
      : 1,
    matched: matched.length,
    total: (expectedTerms || []).length,
    matchedTerms: matched
  };
}

/*
 * requirement-interpreter
 * - requirementExtractionAccuracy:
 *     matched expected business rules / total
 * - hvacTerminologyRecognition:
 *     matched expected HVAC terms / total
 * - ambiguityDetection:
 *     matched expected ambiguities / total
 */
function scoreInterpreter(output, expected) {
  const rulesText = (output.businessRules || [])
    .join(' ');
  const ambiguitiesText = (output.ambiguities || [])
    .join(' ');

  return {
    requirementExtractionAccuracy:
      scoreExpectedItems(
        expected.expectedBusinessRules,
        rulesText
      ),
    hvacTerminologyRecognition:
      scoreTermList(
        expected.expectedHvacTerms,
        output.hvacTerminology
      ),
    ambiguityDetection:
      scoreExpectedItems(
        expected.expectedAmbiguities,
        ambiguitiesText
      )
  };
}

/*
 * adversarial-reviewer
 * - unsupportedAssumptionDetection:
 *     matched expected unsupported-assumption
 *     challenges / total
 * - missingRequirementDetection:
 *     matched expected missing-requirement
 *     challenges / total
 * - challengeQuality:
 *     fraction of findings that carry a valid
 *     severity and an actionable description
 *     (>= 40 chars), plus status consistency
 *     (PASS iff findings array is empty)
 */
function scoreReviewer(output, expected) {
  const findings = output.findings || [];
  const findingsText = findings
    .map(f => f.description || '')
    .join(' ');

  const statusConsistent =
    (output.status === 'PASS') ===
    (findings.length === 0);

  const wellFormed = findings.filter(f =>
    ALLOWED_SEVERITIES.includes(f.severity) &&
    typeof f.description === 'string' &&
    f.description.trim().length >= 40
  ).length;

  const qualityChecks =
    findings.length + 1; // +1 for status consistency
  const qualityPassed =
    wellFormed + (statusConsistent ? 1 : 0);

  return {
    unsupportedAssumptionDetection:
      scoreExpectedItems(
        expected.expectedUnsupportedAssumptions,
        findingsText
      ),
    missingRequirementDetection:
      scoreExpectedItems(
        expected.expectedMissingRequirements,
        findingsText
      ),
    challengeQuality: {
      score: qualityPassed / qualityChecks,
      matched: qualityPassed,
      total: qualityChecks,
      statusConsistent,
      wellFormedFindings: wellFormed,
      totalFindings: findings.length
    }
  };
}

function findingLines(markdown) {
  return (markdown || '')
    .split('\n')
    .filter(line =>
      /high|medium|low/i.test(line) &&
      /severity|^\s*[-*|]/i.test(line)
    );
}

function findingCovered(finding, markdown) {
  const text = (markdown || '').toLowerCase();
  if (
    !text.includes(
      (finding.severity || '').toLowerCase()
    )
  ) {
    return false;
  }
  const hits = significantWords(
    finding.description
  ).filter(w => text.includes(w));
  return hits.length >= 2;
}

/*
 * final-review-writer
 * - findingPreservation:
 *     report must not introduce findings beyond the
 *     reviewer output. Each finding-bearing line in
 *     the report must share >= 2 significant words
 *     with some reviewer finding description.
 * - reportCompleteness:
 *     reviewer findings covered in the report /
 *     total findings (covered = severity label
 *     present AND >= 2 significant words overlap)
 * - outputQuality:
 *     structural checks / 5:
 *       1. H1 heading matching the disposition
 *       2. requirement/summary section present
 *       3. reviewer findings section present
 *       4. final disposition section present
 *       5. disposition value stated in body
 */
function scoreWriter(report, reviewOutput, disposition) {
  const markdown = report.reportMarkdown || '';
  const findings = reviewOutput.findings || [];
  const text = markdown.toLowerCase();

  const completeness =
    findings.length === 0
      ? {
          score:
            /pass|no findings|no outstanding/
              .test(text)
              ? 1
              : 0.5,
          matched: 0,
          total: 0
        }
      : (() => {
          const covered = findings.filter(f =>
            findingCovered(f, markdown)
          ).length;
          return {
            score: covered / findings.length,
            matched: covered,
            total: findings.length
          };
        })();

  const lines = findingLines(markdown);
  let preservation;
  if (findings.length === 0) {
    preservation = {
      score: lines.length === 0 ? 1 : 0,
      matched: 0,
      total: 0,
      note: lines.length
        ? 'Report lists findings although reviewer found none.'
        : 'No findings introduced.'
    };
  } else {
    const supported = lines.filter(line =>
      findings.some(f => {
        const words = significantWords(
          f.description
        ).filter(w =>
          line.toLowerCase().includes(w)
        );
        return words.length >= 2;
      })
    ).length;
    preservation = {
      score: lines.length
        ? supported / lines.length
        : 0,
      matched: supported,
      total: lines.length
    };
  }

  const checks = [
    {
      name: 'dispositionHeading',
      pass: markdown
        .trim()
        .startsWith(`# ${disposition}`)
    },
    {
      name: 'summarySection',
      pass: /summary/i.test(markdown)
    },
    {
      name: 'findingsSection',
      pass: /finding/i.test(markdown)
    },
    {
      name: 'dispositionSection',
      pass: /disposition/i.test(markdown)
    },
    {
      name: 'dispositionStated',
      pass: text.includes(
        (disposition || '').toLowerCase()
      )
    }
  ];

  return {
    findingPreservation: preservation,
    reportCompleteness: completeness,
    outputQuality: {
      score:
        checks.filter(c => c.pass).length /
        checks.length,
      matched: checks.filter(c => c.pass).length,
      total: checks.length,
      checks
    }
  };
}

module.exports = {
  scoreInterpreter,
  scoreReviewer,
  scoreWriter
};
