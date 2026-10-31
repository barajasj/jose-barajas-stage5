const iterations = [
  {
    version: 'v0',
    reason: 'Prospective baseline: unchanged post-F3 production prompts, not reconstructed historical performance.',
    changes: {}
  },
  {
    version: 'v1',
    reason: 'Separate extraction, review comparison, and literal transcription from speculative completion.',
    changes: {
      'requirement-interpreter': [
        'Before answering, privately separate explicit ticket propositions from unanswered questions. Extract each requested behavior and numeric constraint once, with all its conditions. Sample data does not establish policy.',
        'Keep developerConsiderations limited to implementation consequences explicitly required by the ticket. Do not add generic engineering advice. Choose confidence from the scope of unanswered behavior, not from confidence in your prose.'
      ],
      'adversarial-reviewer': [
        'Before drafting findings, compare each ticket proposition against the entire actual interpretation, not businessRules alone. A proposition already captured in the summary or developerConsiderations is not absent everywhere.',
        'For each proposed finding, privately identify the specific defective scalar or the missing proposition. Then copy the shortest sufficient ticket quote and the complete relevant interpreter scalar, with its zero-based pointer. Reject your own finding if the input already corrects the alleged defect.'
      ],
      'final-review-writer': [
        'Treat reportTemplate as an opaque character sequence, not a draft to edit. Produce exactly one JSON string encoding of that sequence as reportMarkdown. Do not regenerate the report from the other input sections.',
        'Use these JSON encoding rules on template characters: an existing backslash becomes \\\\, an existing double quote becomes \\", and a line break becomes \\n. Leave words, punctuation, and Markdown delimiters unchanged.'
      ]
    }
  },
  {
    version: 'v2',
    reason: 'Add a final omission/identity/character audit after the v1 task decomposition; no new facts or output repair.',
    changes: {
      'requirement-interpreter': [
        'Privately audit the draft against the ticket once more: no dropped dependency, no swapped HVAC abbreviation, no lost increment or special configuration override, no invented limit, default, rounding tie rule, or error policy.',
        'Ask separate, concise questions for genuinely unspecified behavior; do not ask a question the ticket answers. On redispatch, perform this audit without rewording unanswered previous ambiguities or changing their resolution identities.'
      ],
      'adversarial-reviewer': [
        'Privately audit every finding before emitting JSON: its claim must still be true for the current input, its action must address exactly that defect, and its severity must reflect impact rather than the number of findings.',
        'Run a final pointer/identity checklist: every current ambiguity index is covered, every interpreter quote equals the complete scalar at that pointer, every non-ambiguity finding has ambiguityRefs: [], and every disappearing prior ID has a supported resolution. Do not turn this checklist into additional findings.'
      ],
      'final-review-writer': [
        'Before returning, privately compare the value obtained by decoding your proposed outer JSON once with reportTemplate from beginning to end. Check the first differing character rather than accepting equivalent meaning.',
        'Specifically check repeated backslashes, quotes inside already quoted Markdown rows, and short conjunctions such as or/and. Preserve them literally. This check is internal only: return no commentary, checksum, or extra fields.'
      ]
    }
  }
];

function revisePrompt(baseline, agent, version) {
  const index = iterations.findIndex(row => row.version === version);
  if (index < 0) throw new Error(`Unknown prompt version: ${version}`);
  const additions = iterations.slice(1, index + 1).flatMap(row => row.changes[agent] || []);
  if (!additions.length) return baseline;
  const marker = '\n## ';
  const offset = baseline.indexOf(marker);
  if (offset < 0) throw new Error('Prompt has no input-section boundary.');
  const text = additions.map(value => `- ${value}`).join('\n');
  return `${baseline.slice(0, offset)}\n## Measurement Revision ${version}\n\n${text}\n${baseline.slice(offset)}`;
}

module.exports = { iterations, revisePrompt };
