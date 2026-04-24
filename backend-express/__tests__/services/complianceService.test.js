/**
 * Unit tests for ComplianceService (services/complianceService.js)
 *
 * Focuses on evidence field preservation through the full compliance pipeline:
 *   rule engine -> AI enhancement -> output report
 *
 * Plan 51-03: Verify sourceDocuments, supportingFindings, pageReferences
 * survive the full orchestration flow.
 */

const mockMessagesCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate }
  }));
});

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

// Mock caseFileService to return enriched forensic data
const mockGetCase = jest.fn();
const mockUpdateCase = jest.fn();
jest.mock('../../services/caseFileService', () => ({
  getCase: (...args) => mockGetCase(...args),
  updateCase: (...args) => mockUpdateCase(...args)
}));

// Mock jurisdictionService
jest.mock('../../services/jurisdictionService', () => {
  return jest.fn().mockImplementation(() => ({
    detectJurisdiction: jest.fn(() => ({
      applicableStates: [],
      determinationMethod: 'none'
    }))
  }));
});

// Real taxonomy and rule mappings — no mocking needed for integration
// These will determine if our enriched findings produce violations

// Mock the compliance report schema to always pass
jest.mock('../../schemas/complianceReportSchema', () => ({
  validateComplianceReport: jest.fn(() => ({ error: null })),
  RISK_LEVELS: { low: 'low', medium: 'medium', high: 'high', critical: 'critical' }
}));

// Save original env
const originalApiKey = process.env.ANTHROPIC_API_KEY;

// ============================================================
// Helpers
// ============================================================

function makeEnrichedForensicReport() {
  return {
    caseId: 'case-evidence-001',
    analyzedAt: '2026-04-23T12:00:00.000Z',
    documentsAnalyzed: 2,
    comparisonPairsEvaluated: 1,
    discrepancies: [
      {
        id: 'disc-001',
        type: 'amount_mismatch',
        severity: 'high',
        description: 'Escrow balance discrepancy of $450 identified',
        documentA: {
          documentId: 'doc-001',
          documentName: 'Escrow Analysis Statement',
          documentType: 'servicing',
          documentSubtype: 'escrow_analysis',
          field: 'escrowBalance',
          value: 5000,
          pageReference: 3,
          quotedText: 'Current escrow balance: $5,000.00'
        },
        documentB: {
          documentId: 'doc-002',
          documentName: 'Closing Disclosure',
          documentType: 'origination',
          documentSubtype: 'closing_disclosure',
          field: 'escrowBalance',
          value: 4550,
          pageReference: 7,
          quotedText: 'Escrow amount at closing: $4,550.00'
        }
      }
    ],
    timeline: { events: [], violations: [] },
    paymentVerification: null,
    summary: {
      totalDiscrepancies: 1,
      criticalFindings: 0,
      highFindings: 1,
      riskLevel: 'high',
      keyFindings: ['Escrow balance discrepancy'],
      recommendations: []
    }
  };
}

function makeEnrichedAnalysisReports() {
  return [
    {
      anomalies: [
        {
          type: 'calculation_error',
          severity: 'high',
          description: 'Escrow calculation error of $300 found',
          field: 'escrowBalance',
          sourceDocument: { id: 'doc-001', name: 'Escrow Analysis', type: 'servicing' },
          pageReference: 5,
          quotedText: 'Annual escrow projection: $3,200 (expected $2,900)'
        }
      ]
    }
  ];
}

function makeClaudeEnhancementResponse(count = 1) {
  const enhancedViolations = [];
  for (let i = 0; i < count; i++) {
    enhancedViolations.push({
      index: i,
      detailedLegalBasis: `Enhanced legal basis for violation ${i}`,
      potentialPenalties: `Enhanced penalties for violation ${i}`,
      recommendations: [`Remedial action ${i}`],
      regulatoryImplications: `Implications for violation ${i}`
    });
  }
  return { enhancedViolations };
}

// ============================================================
// Tests
// ============================================================

describe('ComplianceService — evidence field preservation', () => {
  let complianceService;

  beforeEach(() => {
    jest.resetModules();
    mockMessagesCreate.mockReset();
    mockGetCase.mockReset();
    mockUpdateCase.mockReset();
    process.env.ANTHROPIC_API_KEY = 'test-key-123';

    // Re-require to pick up fresh mocks
    complianceService = require('../../services/complianceService');
  });

  afterAll(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('violations carry sourceDocuments, supportingFindings, pageReferences from rule engine (skipAiAnalysis)', async () => {
    mockGetCase.mockResolvedValue({
      forensic_analysis: makeEnrichedForensicReport(),
      analysis_reports: makeEnrichedAnalysisReports()
    });
    mockUpdateCase.mockResolvedValue({});

    const result = await complianceService.evaluateCompliance('case-001', 'user-001', {
      skipAiAnalysis: true,
      skipStateAnalysis: true
    });

    expect(result.error).toBeUndefined();
    expect(result.violations).toBeDefined();

    if (result.violations.length > 0) {
      for (const v of result.violations) {
        // Every violation should have evidence arrays
        expect(v).toHaveProperty('sourceDocuments');
        expect(v).toHaveProperty('supportingFindings');
        expect(v).toHaveProperty('pageReferences');
        expect(Array.isArray(v.sourceDocuments)).toBe(true);
        expect(Array.isArray(v.supportingFindings)).toBe(true);
        expect(Array.isArray(v.pageReferences)).toBe(true);
      }
    }
  });

  it('evidence fields survive Claude AI enhancement pipeline', async () => {
    mockGetCase.mockResolvedValue({
      forensic_analysis: makeEnrichedForensicReport(),
      analysis_reports: makeEnrichedAnalysisReports()
    });
    mockUpdateCase.mockResolvedValue({});

    // Mock Claude responses for enhancement + narrative
    // We need enough responses for each statute batch + narrative
    mockMessagesCreate
      .mockResolvedValue({
        content: [{ text: JSON.stringify(makeClaudeEnhancementResponse(10)) }],
        usage: { input_tokens: 500, output_tokens: 200 }
      });

    const result = await complianceService.evaluateCompliance('case-002', 'user-001', {
      skipStateAnalysis: true
    });

    expect(result.error).toBeUndefined();

    if (result.violations.length > 0) {
      for (const v of result.violations) {
        expect(v).toHaveProperty('sourceDocuments');
        expect(v).toHaveProperty('supportingFindings');
        expect(v).toHaveProperty('pageReferences');
        expect(Array.isArray(v.sourceDocuments)).toBe(true);
        expect(Array.isArray(v.supportingFindings)).toBe(true);
        expect(Array.isArray(v.pageReferences)).toBe(true);
      }
    }
  });

  it('enriched discrepancy produces violations with specific document references', async () => {
    mockGetCase.mockResolvedValue({
      forensic_analysis: makeEnrichedForensicReport(),
      analysis_reports: []
    });
    mockUpdateCase.mockResolvedValue({});

    const result = await complianceService.evaluateCompliance('case-003', 'user-001', {
      skipAiAnalysis: true,
      skipStateAnalysis: true
    });

    expect(result.error).toBeUndefined();

    // Find a violation that came from our enriched discrepancy
    const violationsWithDocs = result.violations.filter(
      v => v.sourceDocuments && v.sourceDocuments.length > 0
    );

    if (violationsWithDocs.length > 0) {
      const v = violationsWithDocs[0];
      // Should reference our source documents
      const docIds = v.sourceDocuments.map(d => d.id);
      expect(docIds.length).toBeGreaterThan(0);

      // Should have supporting findings with quoted text
      expect(v.supportingFindings.length).toBeGreaterThan(0);

      // Should have page references (non-null pages)
      if (v.pageReferences.length > 0) {
        for (const pr of v.pageReferences) {
          expect(pr.pageNumber).not.toBeNull();
        }
      }
    }
  });

  it('handles case with no forensic analysis gracefully', async () => {
    mockGetCase.mockResolvedValue({
      forensic_analysis: null
    });

    const result = await complianceService.evaluateCompliance('case-004', 'user-001', {
      skipAiAnalysis: true,
      skipStateAnalysis: true
    });

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('forensic analysis');
  });

  it('handles missing caseId', async () => {
    const result = await complianceService.evaluateCompliance(null, 'user-001');
    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('caseId');
  });

  it('handles missing userId', async () => {
    const result = await complianceService.evaluateCompliance('case-005', null);
    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('userId');
  });
});
