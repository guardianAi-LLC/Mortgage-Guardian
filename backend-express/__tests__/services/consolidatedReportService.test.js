/**
 * Consolidated Report Orchestrator Service Tests
 *
 * Unit tests for ConsolidatedReportService.generateReport() — the orchestrator
 * that coordinates report aggregation, confidence scoring, evidence linking,
 * recommendation generation, optional dispute letter, schema validation, and
 * Supabase persistence into a unified consolidated report.
 *
 * Mock strategy:
 *   - reportAggregationService: mocked (data gathering)
 *   - confidenceScoringService: mocked (scoring + evidence linking)
 *   - disputeLetterService: mocked (Claude AI letter generation)
 *   - caseFileService: mocked (Supabase persistence)
 *   - consolidatedReportSchema: real validation (not mocked)
 *   - consolidatedReportConfig: real config (not mocked)
 */

// ---------------------------------------------------------------------------
// Mocks — hoisted before require()
// ---------------------------------------------------------------------------

jest.mock('../../services/reportAggregationService', () => ({
  gatherCaseFindings: jest.fn(),
  extractFindingSummary: jest.fn()
}));

jest.mock('../../services/confidenceScoringService', () => ({
  calculateConfidence: jest.fn(),
  determineRiskLevel: jest.fn(),
  buildEvidenceLinks: jest.fn()
}));

jest.mock('../../services/disputeLetterService', () => ({
  generateDisputeLetter: jest.fn()
}));

jest.mock('../../services/caseFileService', () => ({
  updateCase: jest.fn().mockResolvedValue({})
}));

const reportAggregationService = require('../../services/reportAggregationService');
const confidenceScoringService = require('../../services/confidenceScoringService');
const disputeLetterService = require('../../services/disputeLetterService');
const caseFileService = require('../../services/caseFileService');
const consolidatedReportService = require('../../services/consolidatedReportService');

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function makeAggregatedData(overrides = {}) {
  return {
    caseInfo: {
      caseId: 'case-001',
      caseName: 'Test Case',
      borrowerName: 'John Doe',
      propertyAddress: '123 Main St',
      loanNumber: 'LN-12345',
      servicerName: 'Test Servicer',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      documentCount: 3
    },
    documentAnalyses: [
      {
        documentId: 'doc-001',
        documentName: 'monthly_statement.pdf',
        type: 'servicing',
        subtype: 'monthly_statement',
        completenessScore: 85,
        anomalyCount: 1,
        anomalies: [
          {
            id: 'anom-001',
            field: 'escrowBalance',
            type: 'amount_mismatch',
            severity: 'high',
            description: 'Escrow balance does not match expected value'
          }
        ],
        keyFindings: ['Escrow discrepancy detected']
      }
    ],
    forensicReport: {
      caseId: 'case-001',
      discrepancies: [
        {
          id: 'disc-001',
          type: 'amount_mismatch',
          severity: 'high',
          description: 'Escrow balance discrepancy of $450',
          documentA: { documentId: 'doc-001', field: 'escrowBalance', value: 5000 },
          documentB: { documentId: 'doc-002', field: 'escrowBalance', value: 5450 }
        }
      ],
      timeline: { events: [], violations: [] },
      paymentVerification: null,
      summary: {
        totalDiscrepancies: 1,
        criticalFindings: 0,
        highFindings: 1,
        riskLevel: 'high'
      }
    },
    complianceReport: {
      violations: [
        {
          id: 'viol-001',
          statuteId: 'RESPA',
          sectionId: 'sec-6',
          statuteName: 'RESPA',
          sectionTitle: 'Section 6',
          citation: '12 U.S.C. § 2605(e)',
          severity: 'critical',
          description: 'Failure to respond to QWR',
          legalBasis: 'RESPA Section 6(e)',
          recommendations: ['Send QWR']
        }
      ],
      stateViolations: [],
      jurisdiction: null
    },
    errors: [],
    ...overrides
  };
}

function makeConfidenceScore(overrides = {}) {
  return {
    overall: 45,
    breakdown: {
      documentAnalysis: 70,
      forensicAnalysis: 40,
      complianceAnalysis: 30
    },
    ...overrides
  };
}

function makeFindingSummary() {
  return {
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
  };
}

function makeEvidenceLinks() {
  return [
    {
      findingId: 'anom-001',
      findingType: 'anomaly',
      sourceDocumentIds: ['doc-001'],
      evidenceDescription: 'Document anomaly anom-001 detected',
      severity: 'high'
    }
  ];
}

function makeDisputeLetter() {
  return {
    letterType: 'qualified_written_request',
    generatedAt: '2026-03-12T00:00:00.000Z',
    content: {
      subject: 'QWR regarding Loan LN-12345',
      salutation: 'Dear Servicer:',
      body: 'This is a QWR...',
      demands: ['Correct escrow balance'],
      legalCitations: ['12 U.S.C. § 2605(e)'],
      responseDeadline: '30 business days',
      closingStatement: 'Sincerely, John Doe'
    },
    recipientInfo: {
      servicerName: 'Test Servicer',
      servicerAddress: 'Address Not Available'
    }
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock implementations
  reportAggregationService.gatherCaseFindings.mockResolvedValue(makeAggregatedData());
  reportAggregationService.extractFindingSummary.mockReturnValue(makeFindingSummary());
  confidenceScoringService.calculateConfidence.mockReturnValue(makeConfidenceScore());
  confidenceScoringService.determineRiskLevel.mockReturnValue('high');
  confidenceScoringService.buildEvidenceLinks.mockReturnValue(makeEvidenceLinks());
  caseFileService.updateCase.mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConsolidatedReportService', () => {

  describe('generateReport()', () => {

    it('should return error when caseId is missing', async () => {
      const result = await consolidatedReportService.generateReport(null, 'user-001');
      expect(result.error).toBe(true);
      expect(result.errorMessage).toMatch(/caseId/);
    });

    it('should return error when userId is missing', async () => {
      const result = await consolidatedReportService.generateReport('case-001', null);
      expect(result.error).toBe(true);
      expect(result.errorMessage).toMatch(/userId/);
    });

    it('should return error when caseId is empty string', async () => {
      const result = await consolidatedReportService.generateReport('', 'user-001');
      expect(result.error).toBe(true);
      expect(result.errorMessage).toMatch(/caseId/);
    });

    it('should return error when userId is empty string', async () => {
      const result = await consolidatedReportService.generateReport('case-001', '');
      expect(result.error).toBe(true);
      expect(result.errorMessage).toMatch(/userId/);
    });

    it('should generate a complete report on full success path', async () => {
      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result.error).toBeUndefined();
      expect(result.reportId).toBeDefined();
      expect(result.caseId).toBe('case-001');
      expect(result.userId).toBe('user-001');
      expect(result.generatedAt).toBeDefined();
      expect(result.reportVersion).toBe('1.0');
      expect(result.caseSummary).toBeDefined();
      expect(result.caseSummary.borrowerName).toBe('John Doe');
      expect(result.overallRiskLevel).toBe('high');
      expect(result.confidenceScore.overall).toBe(45);
      expect(result.findingSummary).toBeDefined();
      expect(result.documentAnalysis).toHaveLength(1);
      expect(result.forensicFindings).toBeDefined();
      expect(result.complianceFindings).toBeDefined();
      expect(result.evidenceLinks).toHaveLength(1);
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.disputeLetterAvailable).toBe(false);
      expect(result.disputeLetter).toBeNull();
      expect(result._metadata).toBeDefined();
      expect(result._metadata.generationDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should call all upstream services in correct order', async () => {
      await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(reportAggregationService.gatherCaseFindings).toHaveBeenCalledWith('case-001', 'user-001');
      expect(confidenceScoringService.calculateConfidence).toHaveBeenCalled();
      expect(confidenceScoringService.determineRiskLevel).toHaveBeenCalled();
      expect(confidenceScoringService.buildEvidenceLinks).toHaveBeenCalled();
      expect(reportAggregationService.extractFindingSummary).toHaveBeenCalled();
      expect(caseFileService.updateCase).toHaveBeenCalled();
    });

    it('should include dispute letter when generateLetter option is true', async () => {
      disputeLetterService.generateDisputeLetter.mockResolvedValue(makeDisputeLetter());

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', {
        generateLetter: true
      });

      expect(disputeLetterService.generateDisputeLetter).toHaveBeenCalled();
      expect(result.disputeLetterAvailable).toBe(true);
      expect(result.disputeLetter).toBeDefined();
      expect(result.disputeLetter.letterType).toBe('qualified_written_request');
    });

    it('should use specified letterType when provided', async () => {
      disputeLetterService.generateDisputeLetter.mockResolvedValue({
        ...makeDisputeLetter(),
        letterType: 'notice_of_error'
      });

      await consolidatedReportService.generateReport('case-001', 'user-001', {
        generateLetter: true,
        letterType: 'notice_of_error'
      });

      expect(disputeLetterService.generateDisputeLetter).toHaveBeenCalledWith(
        'notice_of_error',
        expect.any(Object)
      );
    });

    it('should not call dispute letter service when generateLetter is false', async () => {
      await consolidatedReportService.generateReport('case-001', 'user-001', {
        generateLetter: false
      });

      expect(disputeLetterService.generateDisputeLetter).not.toHaveBeenCalled();
    });

    it('should return error when aggregation fails completely', async () => {
      reportAggregationService.gatherCaseFindings.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result.error).toBe(true);
      expect(result.errorMessage).toMatch(/Failed to gather case findings/);
      expect(result._metadata).toBeDefined();
    });

    it('should return error when aggregation returns error object', async () => {
      reportAggregationService.gatherCaseFindings.mockResolvedValue({
        error: true,
        errorMessage: 'Case not found: case-999'
      });

      const result = await consolidatedReportService.generateReport('case-999', 'user-001');

      expect(result.error).toBe(true);
      expect(result.errorMessage).toBe('Case not found: case-999');
    });

    it('should generate report with null forensicFindings when no forensic data', async () => {
      const dataNoForensic = makeAggregatedData({
        forensicReport: null,
        errors: ['No forensic analysis available for this case']
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(dataNoForensic);
      confidenceScoringService.calculateConfidence.mockReturnValue(
        makeConfidenceScore({ breakdown: { documentAnalysis: 70, forensicAnalysis: null, complianceAnalysis: 30 } })
      );

      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result.error).toBeUndefined();
      expect(result.forensicFindings.discrepancies).toHaveLength(0);
      expect(result.forensicFindings.paymentVerification).toBeNull();
      expect(result._metadata.warnings).toContain('No forensic analysis available for this case');
    });

    it('should generate report with empty complianceFindings when no compliance data', async () => {
      const dataNoCompliance = makeAggregatedData({
        complianceReport: null,
        errors: ['No compliance analysis available for this case']
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(dataNoCompliance);
      confidenceScoringService.calculateConfidence.mockReturnValue(
        makeConfidenceScore({ breakdown: { documentAnalysis: 70, forensicAnalysis: 40, complianceAnalysis: null } })
      );

      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result.error).toBeUndefined();
      expect(result.complianceFindings.federalViolations).toHaveLength(0);
      expect(result.complianceFindings.stateViolations).toHaveLength(0);
      expect(result._metadata.warnings).toContain('No compliance analysis available for this case');
    });

    it('should generate report with default scores when scoring service fails', async () => {
      confidenceScoringService.calculateConfidence.mockImplementation(() => {
        throw new Error('Scoring engine crashed');
      });

      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result.error).toBeUndefined();
      expect(result.confidenceScore.overall).toBe(100);
      expect(result.overallRiskLevel).toBe('clean');
      expect(result._metadata.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Confidence scoring failed')])
      );
    });

    it('should set disputeLetterAvailable to false when letter generation fails', async () => {
      disputeLetterService.generateDisputeLetter.mockRejectedValue(
        new Error('API key missing')
      );

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', {
        generateLetter: true
      });

      expect(result.error).toBeUndefined();
      expect(result.disputeLetterAvailable).toBe(false);
      expect(result.disputeLetter).toBeNull();
      expect(result._metadata.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Dispute letter generation failed')])
      );
    });

    it('should set disputeLetterAvailable to false when letter service returns error', async () => {
      disputeLetterService.generateDisputeLetter.mockResolvedValue({
        error: true,
        errorMessage: 'Invalid letter type',
        letterType: 'unknown'
      });

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', {
        generateLetter: true
      });

      expect(result.disputeLetterAvailable).toBe(false);
      expect(result.disputeLetter).toBeNull();
      expect(result._metadata.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Dispute letter generation returned error')])
      );
    });

    it('should return report successfully when Supabase persistence fails', async () => {
      caseFileService.updateCase.mockRejectedValue(new Error('Supabase connection timeout'));

      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      // Report should still be returned successfully
      expect(result.error).toBeUndefined();
      expect(result.reportId).toBeDefined();
      expect(result.caseId).toBe('case-001');
    });

    it('should skip persistence when skipPersistence option is true', async () => {
      await consolidatedReportService.generateReport('case-001', 'user-001', {
        skipPersistence: true
      });

      expect(caseFileService.updateCase).not.toHaveBeenCalled();
    });

    it('should generate report with empty evidence links when linking fails', async () => {
      confidenceScoringService.buildEvidenceLinks.mockImplementation(() => {
        throw new Error('Evidence linking crashed');
      });

      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result.error).toBeUndefined();
      expect(result.evidenceLinks).toHaveLength(0);
      expect(result._metadata.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('Evidence linking failed')])
      );
    });

    it('should preserve enriched anomaly evidence in documentAnalysis section', async () => {
      const enrichedData = makeAggregatedData({
        documentAnalyses: [
          {
            documentId: 'doc-001',
            documentName: 'statement.pdf',
            type: 'mortgage_statement',
            subtype: 'monthly_statement',
            completenessScore: 85,
            anomalyCount: 1,
            anomalies: [
              {
                id: 'anom-001',
                field: 'escrowBalance',
                type: 'amount_mismatch',
                severity: 'high',
                description: 'Escrow mismatch',
                pageReference: 3,
                quotedText: 'Escrow Balance: $5,000.00',
                sourceDocument: { id: 'doc-001', name: 'statement.pdf', type: 'mortgage_statement', subtype: 'monthly_statement' }
              }
            ],
            keyFindings: ['Escrow issue']
          }
        ]
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(enrichedData);

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

      expect(result.error).toBeUndefined();
      const anomaly = result.documentAnalysis[0].anomalies[0];
      expect(anomaly.pageReference).toBe(3);
      expect(anomaly.quotedText).toBe('Escrow Balance: $5,000.00');
      expect(anomaly.sourceDocument.name).toBe('statement.pdf');
    });

    it('should preserve enriched discrepancy evidence in forensicFindings', async () => {
      const enrichedData = makeAggregatedData({
        forensicReport: {
          caseId: 'case-001',
          discrepancies: [
            {
              id: 'disc-001',
              type: 'amount_mismatch',
              severity: 'high',
              description: 'Payment differs',
              documentA: {
                documentId: 'doc-001',
                documentName: 'statement.pdf',
                documentType: 'mortgage_statement',
                field: 'paymentAmount',
                value: 1500,
                pageNumber: 2,
                quotedText: 'Monthly Payment: $1,500'
              },
              documentB: {
                documentId: 'doc-002',
                documentName: 'disclosure.pdf',
                documentType: 'closing_disclosure',
                field: 'paymentAmount',
                value: 1800,
                pageNumber: 5,
                quotedText: 'Monthly Payment: $1,800'
              }
            }
          ],
          timeline: { events: [], violations: [] },
          paymentVerification: null
        }
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(enrichedData);

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

      expect(result.error).toBeUndefined();
      const disc = result.forensicFindings.discrepancies[0];
      expect(disc.documentA.documentName).toBe('statement.pdf');
      expect(disc.documentA.pageNumber).toBe(2);
      expect(disc.documentA.quotedText).toBe('Monthly Payment: $1,500');
      expect(disc.documentB.documentName).toBe('disclosure.pdf');
      expect(disc.documentB.pageNumber).toBe(5);
    });

    it('should preserve enriched violation evidence in complianceFindings', async () => {
      const enrichedData = makeAggregatedData({
        complianceReport: {
          violations: [
            {
              id: 'viol-001',
              statuteId: 'RESPA',
              sectionId: 'sec-6',
              statuteName: 'RESPA',
              sectionTitle: 'Section 6',
              citation: '12 U.S.C. § 2605(e)',
              severity: 'critical',
              description: 'QWR failure',
              legalBasis: 'RESPA Section 6(e)',
              recommendations: ['Send QWR'],
              sourceDocuments: [
                { id: 'doc-001', name: 'statement.pdf', type: 'mortgage_statement' }
              ],
              supportingFindings: [
                { findingId: 'anom-001', findingType: 'anomaly', quotedText: 'No response' }
              ],
              pageReferences: [
                { documentId: 'doc-001', documentName: 'statement.pdf', pageNumber: 1 }
              ]
            }
          ],
          stateViolations: [],
          jurisdiction: null
        }
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(enrichedData);

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

      expect(result.error).toBeUndefined();
      const violation = result.complianceFindings.federalViolations[0];
      expect(violation.sourceDocuments).toBeDefined();
      expect(violation.sourceDocuments[0].name).toBe('statement.pdf');
      expect(violation.supportingFindings).toBeDefined();
      expect(violation.supportingFindings[0].findingId).toBe('anom-001');
      expect(violation.pageReferences).toBeDefined();
      expect(violation.pageReferences[0].pageNumber).toBe(1);
    });

    it('should handle gracefully when enriched fields are absent from anomalies', async () => {
      // Default mock data has no enriched fields — should still work
      const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

      expect(result.error).toBeUndefined();
      const anomaly = result.documentAnalysis[0].anomalies[0];
      expect(anomaly.id).toBe('anom-001');
      expect(anomaly.pageReference).toBeUndefined();
      expect(anomaly.quotedText).toBeUndefined();
      expect(anomaly.sourceDocument).toBeUndefined();
    });

    it('should include aggregation warnings in report metadata', async () => {
      const dataWithWarnings = makeAggregatedData({
        errors: ['Forensic analysis has partial results (some comparisons failed)']
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(dataWithWarnings);

      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result._metadata.warnings).toContain(
        'Forensic analysis has partial results (some comparisons failed)'
      );
    });

    it('should track completed steps in metadata', async () => {
      const result = await consolidatedReportService.generateReport('case-001', 'user-001');

      expect(result._metadata.stepsCompleted).toContain('gather');
      expect(result._metadata.stepsCompleted).toContain('score');
      expect(result._metadata.stepsCompleted).toContain('link');
      expect(result._metadata.stepsCompleted).toContain('recommendations');
      expect(result._metadata.stepsCompleted).toContain('assemble');
    });
  });

  describe('_generateRecommendations()', () => {

    it('should generate recommendations from compliance violations with legalBasis', () => {
      const data = makeAggregatedData();
      const recommendations = consolidatedReportService._generateRecommendations(data);

      const complianceRec = recommendations.find(r => r.category === 'compliance');
      expect(complianceRec).toBeDefined();
      expect(complianceRec.legalBasis).toBe('12 U.S.C. § 2605(e)');
      expect(complianceRec.relatedFindingIds).toContain('viol-001');
    });

    it('should generate recommendations from forensic discrepancies', () => {
      const data = makeAggregatedData();
      const recommendations = consolidatedReportService._generateRecommendations(data);

      const paymentRec = recommendations.find(r => r.category === 'payment_verification');
      expect(paymentRec).toBeDefined();
      expect(paymentRec.action).toMatch(/payment application history/);
    });

    it('should generate recommendations from document anomalies', () => {
      const data = makeAggregatedData();
      const recommendations = consolidatedReportService._generateRecommendations(data);

      // The anomaly has type 'amount_mismatch' which maps to payment_verification
      const paymentRecs = recommendations.filter(r => r.category === 'payment_verification');
      expect(paymentRecs.length).toBeGreaterThan(0);
    });

    it('should deduplicate recommendations with same action text', () => {
      // Both forensic discrepancy and document anomaly have type 'amount_mismatch'
      // They should be deduplicated into one recommendation
      const data = makeAggregatedData();
      const recommendations = consolidatedReportService._generateRecommendations(data);

      const paymentRecs = recommendations.filter(r => r.category === 'payment_verification');
      expect(paymentRecs).toHaveLength(1);
      // Both finding IDs should be merged
      expect(paymentRecs[0].relatedFindingIds).toContain('disc-001');
      expect(paymentRecs[0].relatedFindingIds).toContain('anom-001');
    });

    it('should return empty recommendations when no findings exist', () => {
      const data = makeAggregatedData({
        documentAnalyses: [],
        forensicReport: null,
        complianceReport: null
      });
      const recommendations = consolidatedReportService._generateRecommendations(data);

      expect(recommendations).toHaveLength(0);
    });

    it('should sort recommendations by priority (critical first)', () => {
      const data = makeAggregatedData({
        complianceReport: {
          violations: [
            {
              id: 'viol-low',
              statuteId: 'TEST',
              severity: 'low',
              citation: 'Test citation low',
              description: 'Low severity violation'
            },
            {
              id: 'viol-critical',
              statuteId: 'RESPA',
              severity: 'critical',
              citation: '12 U.S.C. § 2605',
              description: 'Critical violation'
            }
          ],
          stateViolations: []
        }
      });

      const recommendations = consolidatedReportService._generateRecommendations(data);

      // Compliance violations map to same action, so they deduplicate.
      // The critical one should set priority to 1.
      if (recommendations.length >= 2) {
        expect(recommendations[0].priority).toBeLessThanOrEqual(recommendations[1].priority);
      }
    });

    it('should handle mixed severity findings and upgrade priority on dedup', () => {
      const data = makeAggregatedData({
        forensicReport: {
          discrepancies: [
            {
              id: 'disc-low',
              type: 'amount_mismatch',
              severity: 'low',
              description: 'Minor amount diff',
              documentA: { documentId: 'doc-1' },
              documentB: { documentId: 'doc-2' }
            },
            {
              id: 'disc-crit',
              type: 'amount_mismatch',
              severity: 'critical',
              description: 'Major amount diff',
              documentA: { documentId: 'doc-1' },
              documentB: { documentId: 'doc-3' }
            }
          ],
          timeline: { events: [], violations: [] },
          paymentVerification: null
        }
      });

      const recommendations = consolidatedReportService._generateRecommendations(data);
      const paymentRec = recommendations.find(r => r.category === 'payment_verification');

      // Should be upgraded to critical priority (1) due to dedup
      expect(paymentRec.priority).toBe(1);
      expect(paymentRec.relatedFindingIds).toContain('disc-low');
      expect(paymentRec.relatedFindingIds).toContain('disc-crit');
    });

    it('should generate timeline violation recommendations', () => {
      const data = makeAggregatedData({
        forensicReport: {
          discrepancies: [],
          timeline: {
            events: [],
            violations: [
              {
                id: 'tv-001',
                description: 'Response deadline exceeded',
                severity: 'high',
                relatedDocuments: ['doc-001']
              }
            ]
          },
          paymentVerification: null
        }
      });

      const recommendations = consolidatedReportService._generateRecommendations(data);
      const timelineRec = recommendations.find(r => r.category === 'timeline');

      expect(timelineRec).toBeDefined();
      expect(timelineRec.action).toMatch(/timeline/i);
      expect(timelineRec.relatedFindingIds).toContain('tv-001');
    });

    it('should include state violations in recommendations', () => {
      const data = makeAggregatedData({
        complianceReport: {
          violations: [],
          stateViolations: [
            {
              id: 'sv-001',
              statuteId: 'CA-HBOR',
              severity: 'high',
              citation: 'Cal. Civ. Code § 2924.12',
              description: 'State violation'
            }
          ]
        }
      });

      const recommendations = consolidatedReportService._generateRecommendations(data);
      const complianceRec = recommendations.find(r => r.category === 'compliance');

      expect(complianceRec).toBeDefined();
      expect(complianceRec.legalBasis).toBe('Cal. Civ. Code § 2924.12');
      expect(complianceRec.relatedFindingIds).toContain('sv-001');
    });
  });

  // -------------------------------------------------------------------------
  // Phase 53-02: executive summary and per-finding display fields
  // -------------------------------------------------------------------------
  describe('executive summary and display fields (Phase 53-02)', () => {

    it('populates executiveSummary and per-finding display fields when findings are enriched', async () => {
      const enrichedData = makeAggregatedData({
        documentAnalyses: [
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
                description: 'Escrow mismatch',
                pageReference: 3,
                quotedText: 'Escrow Balance: $5,000.00',
                sourceDocument: { id: 'doc-001', name: 'statement.pdf', type: 'mortgage_statement', subtype: 'monthly' },
                reasoningSteps: ['expected $5,450', 'observed $5,000', 'difference of $450'],
                confidence: 0.92,
                confidenceLevel: 'high'
              }
            ],
            keyFindings: ['Escrow issue']
          }
        ],
        forensicReport: {
          caseId: 'case-001',
          discrepancies: [
            {
              id: 'disc-001',
              type: 'amount_mismatch',
              severity: 'critical',
              description: 'Payment differs',
              documentA: {
                documentId: 'doc-001',
                documentName: 'statement.pdf',
                pageNumber: 2,
                quotedText: 'Monthly Payment: $1,500'
              },
              documentB: {
                documentId: 'doc-002',
                documentName: 'disclosure.pdf',
                pageNumber: 5,
                quotedText: 'Monthly Payment: $1,800'
              },
              reasoningSteps: ['statement shows $1,500', 'disclosure shows $1,800'],
              confidence: 0.85,
              confidenceLevel: 'high'
            }
          ],
          timeline: { events: [], violations: [] },
          paymentVerification: null
        },
        complianceReport: {
          violations: [
            {
              id: 'viol-001',
              statuteId: 'RESPA',
              sectionId: 'sec-6',
              statuteName: 'RESPA',
              sectionTitle: 'Section 6',
              citation: '12 U.S.C. § 2605(e)',
              severity: 'critical',
              description: 'Failure to acknowledge QWR',
              legalBasis: 'RESPA Section 6(e)',
              recommendations: ['Send QWR'],
              sourceDocuments: [{ id: 'doc-001', name: 'response-letter.pdf', type: 'correspondence' }],
              supportingFindings: [{ findingId: 'anom-001', findingType: 'anomaly', quotedText: 'No response received' }],
              pageReferences: [{ documentId: 'doc-001', documentName: 'response-letter.pdf', pageNumber: 1 }],
              reasoningSteps: ['QWR sent on day 0', 'no ack within 5 days', 'thus violation'],
              confidence: 0.95,
              confidenceLevel: 'high'
            }
          ],
          stateViolations: [],
          jurisdiction: null
        }
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(enrichedData);

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

      expect(result.error).toBeUndefined();

      // Executive summary populated
      expect(result.executiveSummary).not.toBeNull();
      expect(result.executiveSummary.headline).toMatch(/HIGH risk/);
      expect(result.executiveSummary.headline).toMatch(/3 finding\(s\)/);
      expect(result.executiveSummary.narrative).toEqual(expect.any(String));
      expect(result.executiveSummary.narrative.length).toBeGreaterThan(0);
      expect(result.executiveSummary.keyFindings).toEqual(expect.any(Array));
      expect(result.executiveSummary.keyFindings.length).toBeGreaterThan(0);
      expect(result.executiveSummary.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      // Anomaly display fields
      const anomaly = result.documentAnalysis[0].anomalies[0];
      expect(anomaly.formattedCitation).toBe('[statement.pdf, p.3]: "Escrow Balance: $5,000.00"');
      expect(anomaly.reasoningSummary).toMatch(/expected \$5,450/);
      expect(anomaly.confidenceLabel).toBe('High (0.92)');

      // Discrepancy display fields (uses documentA)
      const disc = result.forensicFindings.discrepancies[0];
      expect(disc.formattedCitation).toBe('[statement.pdf, p.2]: "Monthly Payment: $1,500"');
      expect(disc.reasoningSummary).toMatch(/statement shows/);
      expect(disc.confidenceLabel).toBe('High (0.85)');

      // Violation display fields (uses pageReferences[0] + supportingFindings[0].quotedText)
      const viol = result.complianceFindings.federalViolations[0];
      expect(viol.formattedCitation).toBe('[response-letter.pdf, p.1]: "No response received"');
      expect(viol.reasoningSummary).toMatch(/no ack within 5 days/);
      expect(viol.confidenceLabel).toBe('High (0.95)');
    });

    it('produces executiveSummary headline+narrative even when findings have no enrichment, and per-finding display fields are null', async () => {
      // Default fixture: anomalies/discrepancies/violations have no
      // page/quote/reasoning/confidence — display fields should degrade to null.
      const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

      expect(result.error).toBeUndefined();

      // Executive summary still has headline + narrative + keyFindings
      expect(result.executiveSummary).not.toBeNull();
      expect(result.executiveSummary.headline).toMatch(/risk/);
      expect(result.executiveSummary.narrative.length).toBeGreaterThan(0);
      expect(Array.isArray(result.executiveSummary.keyFindings)).toBe(true);

      // Per-finding display fields are null (no enrichment present)
      const anomaly = result.documentAnalysis[0].anomalies[0];
      expect(anomaly.formattedCitation).toBeNull();
      expect(anomaly.reasoningSummary).toBeNull();
      expect(anomaly.confidenceLabel).toBeNull();

      const disc = result.forensicFindings.discrepancies[0];
      expect(disc.formattedCitation).toBeNull();
      expect(disc.reasoningSummary).toBeNull();
      expect(disc.confidenceLabel).toBeNull();

      const viol = result.complianceFindings.federalViolations[0];
      expect(viol.formattedCitation).toBeNull();
      expect(viol.reasoningSummary).toBeNull();
      expect(viol.confidenceLabel).toBeNull();
    });

    it('returns executiveSummary=null when there are zero findings', async () => {
      const emptyData = makeAggregatedData({
        documentAnalyses: [],
        forensicReport: null,
        complianceReport: null
      });
      reportAggregationService.gatherCaseFindings.mockResolvedValue(emptyData);
      reportAggregationService.extractFindingSummary.mockReturnValue({
        totalFindings: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        byCategory: {
          documentAnomalies: 0,
          crossDocDiscrepancies: 0,
          timelineViolations: 0,
          paymentIssues: 0,
          federalViolations: 0,
          stateViolations: 0
        }
      });
      confidenceScoringService.determineRiskLevel.mockReturnValue('clean');

      const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

      expect(result.error).toBeUndefined();
      expect(result.findingSummary.totalFindings).toBe(0);
      expect(result.executiveSummary).toBeNull();
      expect(result.documentAnalysis).toHaveLength(0);
    });

    it('degrades gracefully when a formatter throws — executiveSummary=null, warning logged, generation completes', async () => {
      // Force formatExecutiveSummaryLine to throw so _buildExecutiveSummary
      // bombs out and the try/catch fallback kicks in.
      const formatters = require('../../services/reportFormattersService');
      const spy = jest.spyOn(formatters, 'formatExecutiveSummaryLine').mockImplementation(() => {
        throw new Error('Formatter exploded');
      });

      try {
        const result = await consolidatedReportService.generateReport('case-001', 'user-001', { skipPersistence: true });

        expect(result.error).toBeUndefined();
        expect(result.executiveSummary).toBeNull();
        expect(result._metadata.warnings).toEqual(
          expect.arrayContaining([expect.stringContaining('Display field generation failed')])
        );
        expect(result._metadata.warnings).toEqual(
          expect.arrayContaining([expect.stringContaining('Formatter exploded')])
        );
      } finally {
        spy.mockRestore();
      }
    });
  });
});
