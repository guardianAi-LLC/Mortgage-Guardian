/**
 * Report Formatters Service
 *
 * Stateless module of pure formatter functions that turn enriched evidence
 * (Phase 51) and structured reasoning (Phase 52) into canonical display
 * strings used by the consolidated report and dispute letter services.
 *
 * Establishes the canonical citation format `[DocName, p.X]: "quotedText"`
 * and the canonical reasoning chain summary used everywhere downstream
 * (report narratives, letter footnotes, frontend display).
 *
 * Pure functions only — no I/O, no async, no Claude calls. Reuses
 * `getConfidenceLevel` from `structuredReasoningConfig.js` as the canonical
 * source of confidence-tier thresholds (Phase 52-01: >=0.85 / >=0.50 / <0.50).
 *
 * Used by: consolidatedReportService (53-02), disputeLetterService (53-03),
 * frontend display layer (53-04).
 */

const { getConfidenceLevel } = require('../config/structuredReasoningConfig');

// ---------------------------------------------------------------------------
// Format Constants
// ---------------------------------------------------------------------------

const QUOTED_TEXT_MAX_CHARS = 200;
const REASONING_STEP_MAX_CHARS = 120;
const DEFAULT_MAX_STEPS = 3;
const DEFAULT_STEP_JOINER = ' → ';
const DEFAULT_SEVERITY = 'info';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Truncate a string to maxLen chars, appending '...' when truncated.
 * Returns the original string when length <= maxLen or when input is falsy.
 *
 * @param {string} text
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(text, maxLen) {
  if (typeof text !== 'string' || text.length <= maxLen) {
    return text;
  }
  return text.slice(0, maxLen) + '...';
}

/**
 * Capitalize the first letter of a string. Returns original if not a string.
 * @param {string} s
 * @returns {string}
 */
function capitalize(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Public formatters
// ---------------------------------------------------------------------------

/**
 * Format a single evidence citation in canonical form:
 *   `[documentName, p.N]: "quotedText"`
 *
 * Gracefully omits sub-sections when fields are missing:
 *   - missing pageNumber → `[documentName]: "quotedText"`
 *   - missing quotedText → `[documentName, p.N]`
 *   - both missing → `[documentName]`
 *   - missing documentName → null
 *
 * Long quotedText is truncated at 200 chars and suffixed with `...`.
 *
 * @example
 *   formatCitation({ documentName: 'statement.pdf', pageNumber: 2, quotedText: '$1,250.00' })
 *   // → '[statement.pdf, p.2]: "$1,250.00"'
 *
 * @example
 *   formatCitation({ documentName: 'statement.pdf' })
 *   // → '[statement.pdf]'
 *
 * @param {object} input
 * @param {string} [input.documentName]
 * @param {number|string} [input.pageNumber]
 * @param {string} [input.quotedText]
 * @returns {string|null}
 */
function formatCitation(input) {
  if (!input || typeof input !== 'object') return null;
  const { documentName, pageNumber, quotedText } = input;

  if (!documentName || typeof documentName !== 'string') return null;

  const hasPage = pageNumber !== undefined && pageNumber !== null && pageNumber !== '';
  const bracket = hasPage ? `[${documentName}, p.${pageNumber}]` : `[${documentName}]`;

  if (!quotedText || typeof quotedText !== 'string') {
    return bracket;
  }

  const safeQuote = truncate(quotedText, QUOTED_TEXT_MAX_CHARS);
  return `${bracket}: "${safeQuote}"`;
}

/**
 * Join an ordered array of reasoning steps into a single display string,
 * truncating each step at 120 chars and trimming the chain to `maxSteps`
 * entries. When more steps exist beyond `maxSteps`, appends ` (+N more)`.
 *
 * Returns null on empty / non-array input.
 *
 * @example
 *   formatReasoningChain(['expected QWR ack within 5 days', 'received none', 'thus violation'])
 *   // → 'expected QWR ack within 5 days → received none → thus violation'
 *
 * @example
 *   formatReasoningChain(['a', 'b', 'c', 'd', 'e'], { maxSteps: 3 })
 *   // → 'a → b → c (+2 more)'
 *
 * @param {string[]} steps
 * @param {object} [opts]
 * @param {number} [opts.maxSteps=3]
 * @param {string} [opts.joiner=' → ']
 * @returns {string|null}
 */
function formatReasoningChain(steps, opts = {}) {
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const { maxSteps = DEFAULT_MAX_STEPS, joiner = DEFAULT_STEP_JOINER } = opts;

  const visible = steps.slice(0, maxSteps).map((step) => {
    if (typeof step !== 'string') return String(step);
    return truncate(step, REASONING_STEP_MAX_CHARS);
  });

  const remaining = steps.length - visible.length;
  const joined = visible.join(joiner);

  return remaining > 0 ? `${joined} (+${remaining} more)` : joined;
}

/**
 * Return a human-readable confidence label like `"High (0.92)"`.
 *
 * Tier source of truth is `getConfidenceLevel` from structuredReasoningConfig
 * (Phase 52-01 thresholds: >=0.85 high, >=0.50 medium, <0.50 low).
 *
 * If `confidenceLevel` is provided it is capitalized and used as-is; otherwise
 * the tier is derived from `confidence`. If both are null/undefined returns null.
 * Confidence is rendered to 2 decimal places when present.
 *
 * @example
 *   formatConfidenceLabel(0.92)            // → 'High (0.92)'
 *   formatConfidenceLabel(0.71, 'medium')  // → 'Medium (0.71)'
 *   formatConfidenceLabel(null, 'low')     // → 'Low'
 *
 * @param {number|null} confidence
 * @param {string|null} [confidenceLevel]
 * @returns {string|null}
 */
function formatConfidenceLabel(confidence, confidenceLevel) {
  const hasConfidence = typeof confidence === 'number' && Number.isFinite(confidence);
  const hasLevel = typeof confidenceLevel === 'string' && confidenceLevel.length > 0;

  if (!hasConfidence && !hasLevel) return null;

  let levelLabel;
  if (hasLevel) {
    levelLabel = capitalize(confidenceLevel);
  } else {
    levelLabel = capitalize(getConfidenceLevel(confidence));
  }

  if (!hasConfidence) {
    return levelLabel;
  }

  return `${levelLabel} (${confidence.toFixed(2)})`;
}

/**
 * Build a structured evidence footnote object suitable for direct use in
 * report and letter output. Filters null/empty citation entries. Returns
 * null when there are no citations and no reasoning to record.
 *
 * @example
 *   buildEvidenceFootnote({
 *     findingId: 'F-1',
 *     citations: ['[a.pdf, p.1]: "x"', null],
 *     reasoningChain: 'step1 → step2',
 *     confidenceLabel: 'High (0.91)'
 *   })
 *   // → { findingId: 'F-1', citations: ['[a.pdf, p.1]: "x"'], reasoning: 'step1 → step2', confidence: 'High (0.91)' }
 *
 * @param {object} input
 * @param {string} [input.findingId]
 * @param {string[]} [input.citations]
 * @param {string|null} [input.reasoningChain]
 * @param {string|null} [input.confidenceLabel]
 * @returns {{ findingId: string|null, citations: string[], reasoning: string|null, confidence: string|null }|null}
 */
function buildEvidenceFootnote(input) {
  if (!input || typeof input !== 'object') return null;
  const { findingId, citations, reasoningChain, confidenceLabel } = input;

  const filteredCitations = Array.isArray(citations)
    ? citations.filter((c) => typeof c === 'string' && c.length > 0)
    : [];
  const reasoning = typeof reasoningChain === 'string' && reasoningChain.length > 0
    ? reasoningChain
    : null;
  const confidence = typeof confidenceLabel === 'string' && confidenceLabel.length > 0
    ? confidenceLabel
    : null;

  if (filteredCitations.length === 0 && !reasoning) {
    return null;
  }

  return {
    findingId: findingId || null,
    citations: filteredCitations,
    reasoning,
    confidence
  };
}

/**
 * Render a one-line executive summary line for a finding.
 *
 * Canonical format:
 *   `[severity] title (Source: documentName, p.N; confidence: level)`
 *
 * Source/confidence parenthetical is omitted entirely if neither is available.
 * Severity defaults to "info" when missing. Title falls back to description
 * → message → "(no description)".
 *
 * @example
 *   formatExecutiveSummaryLine({
 *     severity: 'critical',
 *     title: 'RESPA §6 violation: servicer failed to acknowledge QWR',
 *     sourceDocument: { name: 'response-letter.pdf' },
 *     pageReference: 1,
 *     confidenceLevel: 'high'
 *   })
 *   // → '[critical] RESPA §6 violation: servicer failed to acknowledge QWR (Source: response-letter.pdf, p.1; confidence: high)'
 *
 * @param {object} finding
 * @returns {string}
 */
function formatExecutiveSummaryLine(finding) {
  if (!finding || typeof finding !== 'object') {
    return `[${DEFAULT_SEVERITY}] (no description)`;
  }

  const severity = (typeof finding.severity === 'string' && finding.severity.length > 0)
    ? finding.severity
    : DEFAULT_SEVERITY;

  const title =
    finding.title ||
    finding.description ||
    finding.message ||
    '(no description)';

  // Source assembly: prefer explicit sourceDocument.name, fall back to documentName
  const docName =
    (finding.sourceDocument && typeof finding.sourceDocument === 'object'
      ? finding.sourceDocument.name
      : null) || finding.documentName || null;
  const pageRef =
    finding.pageReference !== undefined && finding.pageReference !== null
      ? finding.pageReference
      : finding.pageNumber !== undefined && finding.pageNumber !== null
        ? finding.pageNumber
        : null;

  let sourceFragment = null;
  if (docName) {
    sourceFragment = pageRef !== null && pageRef !== ''
      ? `Source: ${docName}, p.${pageRef}`
      : `Source: ${docName}`;
  }

  // Confidence assembly: explicit confidenceLevel wins, else derive from confidence
  let confidenceFragment = null;
  if (typeof finding.confidenceLevel === 'string' && finding.confidenceLevel.length > 0) {
    confidenceFragment = `confidence: ${finding.confidenceLevel}`;
  } else if (typeof finding.confidence === 'number' && Number.isFinite(finding.confidence)) {
    confidenceFragment = `confidence: ${getConfidenceLevel(finding.confidence)}`;
  }

  const parts = [sourceFragment, confidenceFragment].filter(Boolean);
  const tail = parts.length > 0 ? ` (${parts.join('; ')})` : '';

  return `[${severity}] ${title}${tail}`;
}

module.exports = {
  formatCitation,
  formatReasoningChain,
  formatConfidenceLabel,
  buildEvidenceFootnote,
  formatExecutiveSummaryLine
};
