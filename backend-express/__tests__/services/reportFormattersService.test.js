/**
 * Unit tests for reportFormattersService (services/reportFormattersService.js)
 *
 * Pure-function module — no mocks needed. Tests cover canonical formatting,
 * partial input degradation, null/empty edge cases, truncation behavior, and
 * confidence-tier boundaries (0.85, 0.50).
 */

const {
  formatCitation,
  formatReasoningChain,
  formatConfidenceLabel,
  buildEvidenceFootnote,
  formatExecutiveSummaryLine
} = require('../../services/reportFormattersService');

// ============================================================
// formatCitation
// ============================================================
describe('formatCitation', () => {
  it('formats all-fields input in canonical [Doc, p.N]: "quote" form', () => {
    const out = formatCitation({
      documentName: 'loan-statement-jan.pdf',
      pageNumber: 2,
      quotedText: 'Principal Balance: $245,000.00'
    });
    expect(out).toBe('[loan-statement-jan.pdf, p.2]: "Principal Balance: $245,000.00"');
  });

  it('omits page section when pageNumber is missing', () => {
    const out = formatCitation({
      documentName: 'statement.pdf',
      quotedText: 'exact quote'
    });
    expect(out).toBe('[statement.pdf]: "exact quote"');
  });

  it('omits quote section when quotedText is missing', () => {
    const out = formatCitation({
      documentName: 'statement.pdf',
      pageNumber: 5
    });
    expect(out).toBe('[statement.pdf, p.5]');
  });

  it('returns just the bracket when both pageNumber and quotedText missing', () => {
    expect(formatCitation({ documentName: 'statement.pdf' })).toBe('[statement.pdf]');
  });

  it('truncates quotedText longer than 200 chars and appends "..."', () => {
    const longText = 'x'.repeat(250);
    const out = formatCitation({
      documentName: 'doc.pdf',
      pageNumber: 1,
      quotedText: longText
    });
    // 200 chars of x then ...
    expect(out).toBe(`[doc.pdf, p.1]: "${'x'.repeat(200)}..."`);
    // Verify total quoted segment length: opening quote + 200 + 3 (...) + closing quote = 205 visible inside ""
    expect(out.length).toBe('[doc.pdf, p.1]: "'.length + 200 + 3 + 1);
  });

  it('does not truncate quotedText at exactly 200 chars', () => {
    const exactText = 'a'.repeat(200);
    const out = formatCitation({
      documentName: 'doc.pdf',
      pageNumber: 1,
      quotedText: exactText
    });
    expect(out).toBe(`[doc.pdf, p.1]: "${exactText}"`);
    expect(out.includes('...')).toBe(false);
  });

  it('returns null for null input', () => {
    expect(formatCitation(null)).toBeNull();
  });

  it('returns null when documentName is missing', () => {
    expect(formatCitation({ pageNumber: 1, quotedText: 'x' })).toBeNull();
  });
});

// ============================================================
// formatReasoningChain
// ============================================================
describe('formatReasoningChain', () => {
  it('returns null for empty array', () => {
    expect(formatReasoningChain([])).toBeNull();
  });

  it('returns null for null input', () => {
    expect(formatReasoningChain(null)).toBeNull();
  });

  it('returns null for non-array input', () => {
    expect(formatReasoningChain('not an array')).toBeNull();
  });

  it('formats a single step without joiner artifacts', () => {
    expect(formatReasoningChain(['only step'])).toBe('only step');
  });

  it('joins steps with default arrow joiner', () => {
    expect(formatReasoningChain(['a', 'b', 'c'])).toBe('a → b → c');
  });

  it('trims to maxSteps and appends "(+N more)" when array is longer', () => {
    const out = formatReasoningChain(['a', 'b', 'c', 'd', 'e'], { maxSteps: 3 });
    expect(out).toBe('a → b → c (+2 more)');
  });

  it('truncates a step longer than 120 chars', () => {
    const longStep = 'y'.repeat(200);
    const out = formatReasoningChain([longStep]);
    expect(out).toBe(`${'y'.repeat(120)}...`);
  });

  it('honors a custom joiner', () => {
    expect(formatReasoningChain(['a', 'b'], { joiner: ' | ' })).toBe('a | b');
  });
});

// ============================================================
// formatConfidenceLabel
// ============================================================
describe('formatConfidenceLabel', () => {
  it('formats 0.92 as "High (0.92)"', () => {
    expect(formatConfidenceLabel(0.92)).toBe('High (0.92)');
  });

  it('formats boundary value 0.85 as High', () => {
    expect(formatConfidenceLabel(0.85)).toBe('High (0.85)');
  });

  it('formats boundary value 0.50 as Medium', () => {
    expect(formatConfidenceLabel(0.5)).toBe('Medium (0.50)');
  });

  it('formats 0.71 as Medium', () => {
    expect(formatConfidenceLabel(0.71)).toBe('Medium (0.71)');
  });

  it('formats 0.49 as Low', () => {
    expect(formatConfidenceLabel(0.49)).toBe('Low (0.49)');
  });

  it('formats 0.34 as Low', () => {
    expect(formatConfidenceLabel(0.34)).toBe('Low (0.34)');
  });

  it('uses explicit confidenceLevel when provided, capitalizing it', () => {
    // explicit "low" overrides what would be derived from 0.99
    expect(formatConfidenceLabel(0.99, 'low')).toBe('Low (0.99)');
  });

  it('uses explicit confidenceLevel without confidence (no parenthetical)', () => {
    expect(formatConfidenceLabel(null, 'high')).toBe('High');
  });

  it('returns null when both confidence and confidenceLevel are missing', () => {
    expect(formatConfidenceLabel(null, null)).toBeNull();
    expect(formatConfidenceLabel(undefined, undefined)).toBeNull();
  });
});

// ============================================================
// buildEvidenceFootnote
// ============================================================
describe('buildEvidenceFootnote', () => {
  it('returns full structured object for full input', () => {
    const out = buildEvidenceFootnote({
      findingId: 'F-1',
      citations: ['[a.pdf, p.1]: "x"', '[b.pdf, p.2]: "y"'],
      reasoningChain: 'step1 → step2',
      confidenceLabel: 'High (0.91)'
    });
    expect(out).toEqual({
      findingId: 'F-1',
      citations: ['[a.pdf, p.1]: "x"', '[b.pdf, p.2]: "y"'],
      reasoning: 'step1 → step2',
      confidence: 'High (0.91)'
    });
  });

  it('returns object with empty reasoning/confidence when only citations present', () => {
    const out = buildEvidenceFootnote({
      findingId: 'F-2',
      citations: ['[a.pdf, p.1]']
    });
    expect(out).toEqual({
      findingId: 'F-2',
      citations: ['[a.pdf, p.1]'],
      reasoning: null,
      confidence: null
    });
  });

  it('returns object with empty citations array when only reasoning present', () => {
    const out = buildEvidenceFootnote({
      findingId: 'F-3',
      reasoningChain: 'a → b'
    });
    expect(out).toEqual({
      findingId: 'F-3',
      citations: [],
      reasoning: 'a → b',
      confidence: null
    });
  });

  it('returns null when there are no citations and no reasoning', () => {
    expect(buildEvidenceFootnote({ findingId: 'F-x' })).toBeNull();
  });

  it('returns null for null input', () => {
    expect(buildEvidenceFootnote(null)).toBeNull();
  });

  it('filters out null and empty citation entries', () => {
    const out = buildEvidenceFootnote({
      findingId: 'F-4',
      citations: ['[a.pdf]', null, '', '[b.pdf]', undefined],
      reasoningChain: 'r'
    });
    expect(out.citations).toEqual(['[a.pdf]', '[b.pdf]']);
  });

  it('uses null findingId when not provided', () => {
    const out = buildEvidenceFootnote({
      citations: ['[c.pdf]']
    });
    expect(out.findingId).toBeNull();
  });
});

// ============================================================
// formatExecutiveSummaryLine
// ============================================================
describe('formatExecutiveSummaryLine', () => {
  it('formats violation with full enrichment in canonical form', () => {
    const out = formatExecutiveSummaryLine({
      severity: 'critical',
      title: 'RESPA §6 violation: servicer failed to acknowledge QWR',
      sourceDocument: { name: 'response-letter.pdf' },
      pageReference: 1,
      confidenceLevel: 'high'
    });
    expect(out).toBe(
      '[critical] RESPA §6 violation: servicer failed to acknowledge QWR (Source: response-letter.pdf, p.1; confidence: high)'
    );
  });

  it('omits Source fragment when no source available (anomaly without source)', () => {
    const out = formatExecutiveSummaryLine({
      severity: 'warning',
      title: 'Unexplained payment',
      confidenceLevel: 'medium'
    });
    expect(out).toBe('[warning] Unexplained payment (confidence: medium)');
  });

  it('omits confidence fragment when no confidence available (discrepancy without confidence)', () => {
    const out = formatExecutiveSummaryLine({
      severity: 'info',
      title: 'Balance mismatch between statements',
      sourceDocument: { name: 'jan.pdf' },
      pageReference: 3
    });
    expect(out).toBe('[info] Balance mismatch between statements (Source: jan.pdf, p.3)');
  });

  it('omits parenthetical entirely when neither source nor confidence present', () => {
    const out = formatExecutiveSummaryLine({
      severity: 'critical',
      title: 'Bare finding'
    });
    expect(out).toBe('[critical] Bare finding');
  });

  it('defaults severity to "info" when missing', () => {
    const out = formatExecutiveSummaryLine({
      title: 'Severity-less finding'
    });
    expect(out).toBe('[info] Severity-less finding');
  });

  it('falls back to description when title missing', () => {
    const out = formatExecutiveSummaryLine({
      severity: 'critical',
      description: 'Found via description field'
    });
    expect(out).toBe('[critical] Found via description field');
  });

  it('derives confidence level from numeric confidence when level not given', () => {
    const out = formatExecutiveSummaryLine({
      severity: 'critical',
      title: 'X',
      confidence: 0.92
    });
    expect(out).toBe('[critical] X (confidence: high)');
  });

  it('handles null/undefined input by returning a default-shaped line', () => {
    const out = formatExecutiveSummaryLine(null);
    expect(out).toBe('[info] (no description)');
  });
});
