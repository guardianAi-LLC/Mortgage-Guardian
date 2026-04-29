/**
 * Consolidated Report Schema — Joi validation tests.
 *
 * Focuses on Phase 53-02 additions:
 *   - top-level `executiveSummary` (nullable, optional)
 *   - per-finding display fields on anomalies, forensic discrepancies,
 *     and compliance violations: `formattedCitation`, `reasoningSummary`,
 *     `confidenceLabel`
 *
 * All additions are optional with safe defaults to preserve backward
 * compatibility (51-04, 52-06 patterns).
 */

const {
  consolidatedReportSchema,
  validateConsolidatedReport
} = require('../../schemas/consolidatedReportSchema');

// ---------------------------------------------------------------------------
// Baseline valid-report fixture
// ---------------------------------------------------------------------------

function makeValidReport(overrides = {}) {
  return {
    reportId: '11111111-1111-4111-8111-111111111111',
    caseId: 'case-001',
    userId: 'user-001',
    generatedAt: '2026-04-29T00:00:00.000Z',
    reportVersion: '1.0',
    caseSummary: {
      borrowerName: 'John Doe',
      propertyAddress: '123 Main St',
      loanNumber: 'LN-12345',
      servicerName: 'Test Servicer',
      documentCount: 2,
      caseCreatedAt: '2026-01-01T00:00:00.000Z'
    },
    overallRiskLevel: 'high',
    confidenceScore: {
      overall: 75,
      breakdown: {
        documentAnalysis: 80,
        forensicAnalysis: 70,
        complianceAnalysis: 75
      }
    },
    findingSummary: {
      totalFindings: 3,
      bySeverity: { critical: 1, high: 1, medium: 1, low: 0, info: 0 },
      byCategory: {
        documentAnomalies: 1,
        crossDocDiscrepancies: 1,
        timelineViolations: 0,
        paymentIssues: 0,
        federalViolations: 1,
        stateViolations: 0
      }
    },
    documentAnalysis: [
      {
        documentId: 'doc-001',
        documentName: 'statement.pdf',
        type: 'mortgage_statement',
        subtype: 'monthly',
        completenessScore: 85,
        anomalyCount: 1,
        anomalies: [
          {
            id: 'anom-001',
            field: 'escrowBalance',
            type: 'amount_mismatch',
            severity: 'high',
            description: 'Escrow mismatch'
          }
        ],
        keyFindings: ['Escrow discrepancy']
      }
    ],
    forensicFindings: {
      discrepancies: [
        {
          id: 'disc-001',
          type: 'amount_mismatch',
          severity: 'high',
          description: 'Payment differs',
          documentIds: ['doc-001', 'doc-002']
        }
      ],
      timelineViolations: [],
      paymentVerification: null
    },
    complianceFindings: {
      federalViolations: [
        {
          id: 'viol-001',
          statuteId: 'RESPA',
          sectionId: 'sec-6',
          statuteName: 'Real Estate Settlement Procedures Act',
          sectionTitle: 'Section 6',
          citation: '12 U.S.C. § 2605(e)',
          severity: 'critical',
          description: 'Failure to acknowledge QWR',
          legalBasis: 'RESPA Section 6(e) requires acknowledgment within 5 days'
        }
      ],
      stateViolations: [],
      jurisdiction: null
    },
    evidenceLinks: [],
    recommendations: [],
    disputeLetterAvailable: false,
    disputeLetter: null,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Sanity: baseline fixture validates
// ---------------------------------------------------------------------------

describe('consolidatedReportSchema — baseline', () => {
  test('baseline fixture validates without error', () => {
    const { error } = consolidatedReportSchema.validate(makeValidReport(), { abortEarly: false });
    expect(error).toBeUndefined();
  });

  test('validateConsolidatedReport helper reports valid', () => {
    const result = validateConsolidatedReport(makeValidReport());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// executiveSummary (Phase 53-02)
// ---------------------------------------------------------------------------

describe('executiveSummary (Phase 53-02)', () => {
  test('validates a report with a fully populated executiveSummary', () => {
    const report = makeValidReport({
      executiveSummary: {
        headline: 'HIGH risk: 3 finding(s) across 2 document(s)',
        narrative: 'Para 1.\n\nPara 2.\n\nPara 3.',
        keyFindings: [
          '[critical] RESPA §6 violation (Source: statement.pdf, p.1; confidence: high)',
          '[high] Escrow mismatch (Source: statement.pdf, p.3; confidence: medium)'
        ],
        generatedAt: '2026-04-29T00:00:00.000Z'
      }
    });
    const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
    expect(error).toBeUndefined();
    expect(value.executiveSummary.headline).toMatch(/HIGH risk/);
    expect(value.executiveSummary.keyFindings).toHaveLength(2);
  });

  test('validates a report with executiveSummary explicitly null', () => {
    const report = makeValidReport({ executiveSummary: null });
    const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
    expect(error).toBeUndefined();
    expect(value.executiveSummary).toBeNull();
  });

  test('validates a report with executiveSummary omitted (default null applied)', () => {
    const report = makeValidReport(); // no executiveSummary key
    const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
    expect(error).toBeUndefined();
    expect(value.executiveSummary).toBeNull();
  });

  test('validates partial executiveSummary (only headline)', () => {
    const report = makeValidReport({
      executiveSummary: { headline: 'CLEAN risk: 0 finding(s)' }
    });
    const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
    expect(error).toBeUndefined();
    expect(value.executiveSummary.headline).toBe('CLEAN risk: 0 finding(s)');
    expect(value.executiveSummary.keyFindings).toEqual([]); // default applied
  });

  test('rejects non-string headline', () => {
    const report = makeValidReport({
      executiveSummary: { headline: 12345, narrative: 'ok' }
    });
    const { error } = consolidatedReportSchema.validate(report, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.details.some(d => d.path.includes('headline'))).toBe(true);
  });

  test('rejects non-array keyFindings', () => {
    const report = makeValidReport({
      executiveSummary: { headline: 'h', keyFindings: 'not-an-array' }
    });
    const { error } = consolidatedReportSchema.validate(report, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.details.some(d => d.path.includes('keyFindings'))).toBe(true);
  });

  test('rejects invalid generatedAt (non-ISO)', () => {
    const report = makeValidReport({
      executiveSummary: { headline: 'h', generatedAt: 'not-a-date' }
    });
    const { error } = consolidatedReportSchema.validate(report, { abortEarly: false });
    expect(error).toBeDefined();
    expect(error.details.some(d => d.path.includes('generatedAt'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// per-finding display fields (Phase 53-02)
// ---------------------------------------------------------------------------

describe('per-finding display fields (Phase 53-02)', () => {

  // ---------------- anomaly ----------------
  describe('anomaly display fields', () => {
    test('validates anomaly with all three fields populated', () => {
      const report = makeValidReport();
      report.documentAnalysis[0].anomalies[0].formattedCitation = '[statement.pdf, p.3]: "Escrow $5,000"';
      report.documentAnalysis[0].anomalies[0].reasoningSummary = 'expected → actual → mismatch';
      report.documentAnalysis[0].anomalies[0].confidenceLabel = 'High (0.92)';

      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const anomaly = value.documentAnalysis[0].anomalies[0];
      expect(anomaly.formattedCitation).toBe('[statement.pdf, p.3]: "Escrow $5,000"');
      expect(anomaly.reasoningSummary).toBe('expected → actual → mismatch');
      expect(anomaly.confidenceLabel).toBe('High (0.92)');
    });

    test('validates anomaly with all three fields explicitly null', () => {
      const report = makeValidReport();
      report.documentAnalysis[0].anomalies[0].formattedCitation = null;
      report.documentAnalysis[0].anomalies[0].reasoningSummary = null;
      report.documentAnalysis[0].anomalies[0].confidenceLabel = null;

      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const anomaly = value.documentAnalysis[0].anomalies[0];
      expect(anomaly.formattedCitation).toBeNull();
      expect(anomaly.reasoningSummary).toBeNull();
      expect(anomaly.confidenceLabel).toBeNull();
    });

    test('validates anomaly with all three fields omitted (defaults applied)', () => {
      const report = makeValidReport();
      // Default fixture omits these fields
      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const anomaly = value.documentAnalysis[0].anomalies[0];
      expect(anomaly.formattedCitation).toBeNull();
      expect(anomaly.reasoningSummary).toBeNull();
      expect(anomaly.confidenceLabel).toBeNull();
    });

    test('rejects non-string formattedCitation on anomaly', () => {
      const report = makeValidReport();
      report.documentAnalysis[0].anomalies[0].formattedCitation = 42;
      const { error } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeDefined();
      expect(error.details.some(d => d.path.includes('formattedCitation'))).toBe(true);
    });
  });

  // ---------------- forensic discrepancy ----------------
  describe('forensic discrepancy display fields', () => {
    test('validates discrepancy with all three fields populated', () => {
      const report = makeValidReport();
      report.forensicFindings.discrepancies[0].formattedCitation = '[statement.pdf, p.2]: "Payment $1,500"';
      report.forensicFindings.discrepancies[0].reasoningSummary = 'a → b → c';
      report.forensicFindings.discrepancies[0].confidenceLabel = 'Medium (0.71)';

      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const disc = value.forensicFindings.discrepancies[0];
      expect(disc.formattedCitation).toBe('[statement.pdf, p.2]: "Payment $1,500"');
      expect(disc.reasoningSummary).toBe('a → b → c');
      expect(disc.confidenceLabel).toBe('Medium (0.71)');
    });

    test('validates discrepancy with all three fields explicitly null', () => {
      const report = makeValidReport();
      report.forensicFindings.discrepancies[0].formattedCitation = null;
      report.forensicFindings.discrepancies[0].reasoningSummary = null;
      report.forensicFindings.discrepancies[0].confidenceLabel = null;

      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      expect(value.forensicFindings.discrepancies[0].formattedCitation).toBeNull();
    });

    test('validates discrepancy with all three fields omitted (defaults applied)', () => {
      const report = makeValidReport();
      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const disc = value.forensicFindings.discrepancies[0];
      expect(disc.formattedCitation).toBeNull();
      expect(disc.reasoningSummary).toBeNull();
      expect(disc.confidenceLabel).toBeNull();
    });

    test('rejects non-string reasoningSummary on discrepancy', () => {
      const report = makeValidReport();
      report.forensicFindings.discrepancies[0].reasoningSummary = ['array', 'not', 'string'];
      const { error } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeDefined();
      expect(error.details.some(d => d.path.includes('reasoningSummary'))).toBe(true);
    });
  });

  // ---------------- compliance violation ----------------
  describe('compliance violation display fields', () => {
    test('validates federal violation with all three fields populated', () => {
      const report = makeValidReport();
      report.complianceFindings.federalViolations[0].formattedCitation = '[response.pdf, p.1]: "no ack"';
      report.complianceFindings.federalViolations[0].reasoningSummary = 'expected → none → violation';
      report.complianceFindings.federalViolations[0].confidenceLabel = 'High (0.95)';

      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const viol = value.complianceFindings.federalViolations[0];
      expect(viol.formattedCitation).toBe('[response.pdf, p.1]: "no ack"');
      expect(viol.reasoningSummary).toBe('expected → none → violation');
      expect(viol.confidenceLabel).toBe('High (0.95)');
    });

    test('validates federal violation with all three fields explicitly null', () => {
      const report = makeValidReport();
      report.complianceFindings.federalViolations[0].formattedCitation = null;
      report.complianceFindings.federalViolations[0].reasoningSummary = null;
      report.complianceFindings.federalViolations[0].confidenceLabel = null;

      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      expect(value.complianceFindings.federalViolations[0].formattedCitation).toBeNull();
    });

    test('validates federal violation with all three fields omitted (defaults applied)', () => {
      const report = makeValidReport();
      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const viol = value.complianceFindings.federalViolations[0];
      expect(viol.formattedCitation).toBeNull();
      expect(viol.reasoningSummary).toBeNull();
      expect(viol.confidenceLabel).toBeNull();
    });

    test('validates state violation with all three fields populated', () => {
      const report = makeValidReport({
        complianceFindings: {
          federalViolations: [],
          stateViolations: [
            {
              id: 'sv-001',
              statuteId: 'CA-HBOR',
              sectionId: 'sec-2924',
              statuteName: 'CA Homeowner Bill of Rights',
              sectionTitle: '§2924.12',
              citation: 'Cal. Civ. Code § 2924.12',
              severity: 'high',
              description: 'State violation',
              legalBasis: 'CA HBOR §2924.12',
              jurisdiction: 'CA',
              formattedCitation: '[notice.pdf, p.2]: "no contact"',
              reasoningSummary: 'expected → none',
              confidenceLabel: 'Medium (0.65)'
            }
          ],
          jurisdiction: null
        }
      });

      const { error, value } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeUndefined();
      const sv = value.complianceFindings.stateViolations[0];
      expect(sv.formattedCitation).toBe('[notice.pdf, p.2]: "no contact"');
      expect(sv.reasoningSummary).toBe('expected → none');
      expect(sv.confidenceLabel).toBe('Medium (0.65)');
    });

    test('rejects non-string confidenceLabel on violation', () => {
      const report = makeValidReport();
      report.complianceFindings.federalViolations[0].confidenceLabel = { not: 'a string' };
      const { error } = consolidatedReportSchema.validate(report, { abortEarly: false });
      expect(error).toBeDefined();
      expect(error.details.some(d => d.path.includes('confidenceLabel'))).toBe(true);
    });
  });
});
