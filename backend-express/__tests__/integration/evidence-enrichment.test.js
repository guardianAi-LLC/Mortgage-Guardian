/**
 * Evidence Enrichment End-to-End Pipeline Tests
 *
 * Verifies the complete evidence enrichment pipeline from document analysis
 * through consolidated report and dispute letter generation. Each test covers
 * a distinct stage of the pipeline to ensure enriched evidence (pageReferences,
 * quotedText, sourceDocuments, supportingFindings) flows through correctly.
 *
 * Phase 51 final verification: all 5 enrichment plans are exercised here.
 *
 * Mock strategy:
 *   - Anthropic SDK: mocked (returns enriched anomalies/discrepancies)
 *   - Supabase: mocked (no database I/O)
 *   - caseFileService: mocked (returns synthetic case data with enriched findings)
 *   - All other services: REAL — analysis, scoring, evidence linking,
 *     compliance, and report assembly run with actual logic
 */

// ---------------------------------------------------------------------------
// Mocks — external I/O boundaries only
// ---------------------------------------------------------------------------

jest.mock('../../services/caseFileService', () => ({
  getCase: jest.fn(),
  updateCase: jest.fn().mockResolvedValue({})
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({ data: null, error: null })),
            order: jest.fn(() => ({ data: [], error: null }))
          })),
          single: jest.fn(() => ({ data: null, error: null }))
        }))
      }))
    }))
  }))
}));

jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

const caseFileService = require('../../services/caseFileService');
const consolidatedReportService = require('../../services/consolidatedReportService');
const confidenceScoringService = require('../../services/confidenceScoringService');
const disputeLetterService = require('../../services/disputeLetterService');

// ---------------------------------------------------------------------------
// Test fixtures — enriched case data with evidence fields at every level
// ---------------------------------------------------------------------------

/**
 * Build a case data object with enriched evidence at every level of the
 * analysis pipeline: anomalies have pageReference/quotedText/sourceDocument,
 * discrepancies have per-document evidence, compliance violations have
 * sourceDocuments/supportingFindings/pageReferences.
 */
function makeEnrichedCaseData() {
  return {
    id: 'case-enrich-001',
    user_id: 'user-enrich-001',
    case_name: 'Evidence Enrichment E2E Test',
    borrower_name: 'Alice Johnson',
    property_address: '789 Oak Ave, Springfield, IL 62701',
    loan_number: 'LN-ENRICH-001',
    servicer_name: 'National Mortgage Corp',
    status: 'active',
    created_at: '2026-01-10T08:00:00.000Z',
    documents: [
      {
        document_id: 'doc-enrich-001',
        analysis_report: {
          documentInfo: {
            documentId: 'doc-enrich-001',
            fileName: 'monthly-statement-jan.pdf',
            classificationType: 'mortgage_statement',
            classificationSubtype: 'monthly_statement'
          },
          completeness: { score: 90, totalExpected: 10, totalFound: 9 },
          anomalies: [
            {
              id: 'anom-enrich-001',
              field: 'escrowBalance',
              type: 'amount_mismatch',
              severity: 'high',
              description: 'Escrow balance does not match prior statement',
              // Enriched evidence fields (Phase 51-01)
              pageReference: 2,
              quotedText: 'Current Escrow Balance: $1,245.00',
              sourceDocument: {
                id: 'doc-enrich-001',
                name: 'monthly-statement-jan.pdf',
                type: 'mortgage_statement',
                subtype: 'monthly_statement'
              }
            },
            {
              id: 'anom-enrich-002',
              field: 'interestRate',
              type: 'calculation_error',
              severity: 'medium',
              description: 'Interest calculation inconsistent with stated rate',
              pageReference: 3,
              quotedText: 'Interest Rate: 4.750% (calculated: 5.125%)',
              sourceDocument: {
                id: 'doc-enrich-001',
                name: 'monthly-statement-jan.pdf',
                type: 'mortgage_statement',
                subtype: 'monthly_statement'
              }
            }
          ],
          summary: {
            riskLevel: 'medium',
            keyFindings: ['Escrow discrepancy', 'Interest calculation error']
          }
        }
      },
      {
        document_id: 'doc-enrich-002',
        analysis_report: {
          documentInfo: {
            documentId: 'doc-enrich-002',
            fileName: 'closing-disclosure.pdf',
            classificationType: 'closing_document',
            classificationSubtype: 'closing_disclosure'
          },
          completeness: { score: 95, totalExpected: 12, totalFound: 11 },
          anomalies: [
            {
              id: 'anom-enrich-003',
              field: 'loanAmount',
              type: 'amount_mismatch',
              severity: 'critical',
              description: 'Loan amount does not match promissory note',
              pageReference: 1,
              quotedText: 'Loan Amount: $245,000.00',
              sourceDocument: {
                id: 'doc-enrich-002',
                name: 'closing-disclosure.pdf',
                type: 'closing_document',
                subtype: 'closing_disclosure'
              }
            }
          ],
          summary: {
            riskLevel: 'high',
            keyFindings: ['Loan amount mismatch']
          }
        }
      }
    ],
    forensic_analysis: {
      caseId: 'case-enrich-001',
      analyzedAt: '2026-01-20T12:00:00Z',
      documentsAnalyzed: 2,
      discrepancies: [
        {
          id: 'disc-enrich-001',
          type: 'amount_mismatch',
          severity: 'high',
          description: 'Escrow balance differs between statement and closing disclosure',
          // Enriched per-document evidence (Phase 51-02)
          documentA: {
            documentId: 'doc-enrich-001',
            documentName: 'monthly-statement-jan.pdf',
            documentType: 'mortgage_statement',
            field: 'escrowBalance',
            value: '$1,245.00',
            pageNumber: 2,
            quotedText: 'Current Escrow Balance: $1,245.00'
          },
          documentB: {
            documentId: 'doc-enrich-002',
            documentName: 'closing-disclosure.pdf',
            documentType: 'closing_document',
            field: 'escrowBalance',
            value: '$1,890.00',
            pageNumber: 4,
            quotedText: 'Initial Escrow at Closing: $1,890.00'
          }
        },
        {
          id: 'disc-enrich-002',
          type: 'date_inconsistency',
          severity: 'medium',
          description: 'Origination date differs between documents',
          documentA: {
            documentId: 'doc-enrich-001',
            documentName: 'monthly-statement-jan.pdf',
            documentType: 'mortgage_statement',
            field: 'originationDate',
            value: '2024-03-15',
            pageNumber: 1,
            quotedText: 'Origination Date: 03/15/2024'
          },
          documentB: {
            documentId: 'doc-enrich-002',
            documentName: 'closing-disclosure.pdf',
            documentType: 'closing_document',
            field: 'closingDate',
            value: '2024-03-20',
            pageNumber: 1,
            quotedText: 'Date Issued: 03/20/2024'
          }
        }
      ],
      timeline: {
        events: [],
        violations: [
          {
            id: 'tv-enrich-001',
            description: 'RESPA response deadline exceeded by 20 days',
            severity: 'critical',
            relatedDocuments: ['doc-enrich-001', 'doc-enrich-002'],
            regulation: 'RESPA Section 6'
          }
        ]
      },
      paymentVerification: {
        verified: true,
        transactionsAnalyzed: 6,
        matchedPayments: [{ id: 'pm-1' }, { id: 'pm-2' }],
        unmatchedDocumentPayments: [{ id: 'pm-3' }],
        unmatchedTransactions: [],
        escrowAnalysis: {},
        feeAnalysis: { irregularities: [] }
      },
      summary: {
        totalDiscrepancies: 2,
        riskLevel: 'high'
      }
    },
    compliance_report: {
      caseId: 'case-enrich-001',
      analyzedAt: '2026-01-21T14:00:00Z',
      violations: [
        {
          id: 'viol-enrich-001',
          statuteId: 'respa',
          sectionId: 'respa_qwr_response',
          statuteName: 'Real Estate Settlement Procedures Act',
          sectionTitle: 'QWR Response Requirements',
          citation: '12 USC 2605(e)',
          severity: 'critical',
          description: 'Servicer failed to respond to QWR within 30 days',
          legalBasis: 'RESPA requires acknowledgment within 5 days and substantive response within 30 days',
          potentialPenalties: 'Actual damages plus statutory damages up to $2,000',
          recommendations: ['File QWR with certified mail'],
          // Enriched violation evidence (Phase 51-03)
          sourceDocuments: [
            { id: 'doc-enrich-001', name: 'monthly-statement-jan.pdf', type: 'mortgage_statement' },
            { id: 'doc-enrich-002', name: 'closing-disclosure.pdf', type: 'closing_document' }
          ],
          supportingFindings: [
            { findingId: 'anom-enrich-001', findingType: 'anomaly', quotedText: 'Current Escrow Balance: $1,245.00' },
            { findingId: 'disc-enrich-001', findingType: 'discrepancy', quotedText: 'Escrow balance differs between statement and closing disclosure' }
          ],
          pageReferences: [
            { documentId: 'doc-enrich-001', documentName: 'monthly-statement-jan.pdf', pageNumber: 2 },
            { documentId: 'doc-enrich-002', documentName: 'closing-disclosure.pdf', pageNumber: 4 }
          ]
        }
      ],
      stateViolations: [
        {
          id: 'sviol-enrich-001',
          statuteId: 'il_ica',
          sectionId: 'il_ica_interest',
          statuteName: 'Illinois Interest Act',
          sectionTitle: 'Interest Overcharge',
          citation: '815 ILCS 205/4',
          severity: 'high',
          description: 'Interest overcharge on escrow account',
          legalBasis: 'Illinois law limits interest rates on mortgage escrow accounts',
          jurisdiction: 'IL',
          recommendations: ['Request refund of overcharged interest'],
          // Enriched state violation evidence
          sourceDocuments: [
            { id: 'doc-enrich-001', name: 'monthly-statement-jan.pdf', type: 'mortgage_statement' }
          ],
          supportingFindings: [
            { findingId: 'anom-enrich-002', findingType: 'anomaly', quotedText: 'Interest Rate: 4.750% (calculated: 5.125%)' }
          ],
          pageReferences: [
            { documentId: 'doc-enrich-001', documentName: 'monthly-statement-jan.pdf', pageNumber: 3 }
          ]
        }
      ],
      jurisdiction: {
        propertyState: 'IL',
        servicerState: 'TX',
        applicableStates: ['IL']
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  caseFileService.updateCase.mockResolvedValue({});
});

describe('Evidence Enrichment End-to-End Pipeline', () => {

  // =========================================================================
  // Test (a): Document analysis enrichment — anomalies carry evidence fields
  // =========================================================================

  it('document analysis anomalies include pageReference, quotedText, and sourceDocument in the consolidated report', async () => {
    caseFileService.getCase.mockResolvedValue(makeEnrichedCaseData());

    const report = await consolidatedReportService.generateReport(
      'case-enrich-001', 'user-enrich-001', { skipPersistence: true }
    );

    expect(report.error).toBeUndefined();
    expect(report.documentAnalysis).toBeDefined();
    expect(report.documentAnalysis.length).toBeGreaterThanOrEqual(2);

    // Check first document's anomalies carry enriched evidence
    const doc1 = report.documentAnalysis.find(d => d.documentId === 'doc-enrich-001');
    expect(doc1).toBeDefined();
    expect(doc1.anomalies.length).toBeGreaterThanOrEqual(2);

    const anom1 = doc1.anomalies.find(a => a.id === 'anom-enrich-001');
    expect(anom1).toBeDefined();
    expect(anom1.pageReference).toBe(2);
    expect(anom1.quotedText).toBe('Current Escrow Balance: $1,245.00');
    expect(anom1.sourceDocument).toEqual({
      id: 'doc-enrich-001',
      name: 'monthly-statement-jan.pdf',
      type: 'mortgage_statement',
      subtype: 'monthly_statement'
    });

    // Check second anomaly
    const anom2 = doc1.anomalies.find(a => a.id === 'anom-enrich-002');
    expect(anom2).toBeDefined();
    expect(anom2.pageReference).toBe(3);
    expect(anom2.quotedText).toContain('Interest Rate');
  });

  // =========================================================================
  // Test (b): Cross-document enrichment — discrepancies carry per-document evidence
  // =========================================================================

  it('cross-document discrepancies include per-document pageNumber, quotedText, and documentName', async () => {
    caseFileService.getCase.mockResolvedValue(makeEnrichedCaseData());

    const report = await consolidatedReportService.generateReport(
      'case-enrich-001', 'user-enrich-001', { skipPersistence: true }
    );

    expect(report.error).toBeUndefined();
    expect(report.forensicFindings).toBeDefined();
    expect(report.forensicFindings.discrepancies.length).toBeGreaterThanOrEqual(2);

    const disc1 = report.forensicFindings.discrepancies.find(d => d.id === 'disc-enrich-001');
    expect(disc1).toBeDefined();

    // Document A evidence
    expect(disc1.documentA).toBeDefined();
    expect(disc1.documentA.documentName).toBe('monthly-statement-jan.pdf');
    expect(disc1.documentA.pageNumber).toBe(2);
    expect(disc1.documentA.quotedText).toBe('Current Escrow Balance: $1,245.00');

    // Document B evidence
    expect(disc1.documentB).toBeDefined();
    expect(disc1.documentB.documentName).toBe('closing-disclosure.pdf');
    expect(disc1.documentB.pageNumber).toBe(4);
    expect(disc1.documentB.quotedText).toBe('Initial Escrow at Closing: $1,890.00');
  });

  // =========================================================================
  // Test (c): Compliance evidence linking — violations include source documents
  // =========================================================================

  it('compliance violations include sourceDocuments, supportingFindings, and pageReferences', async () => {
    caseFileService.getCase.mockResolvedValue(makeEnrichedCaseData());

    const report = await consolidatedReportService.generateReport(
      'case-enrich-001', 'user-enrich-001', { skipPersistence: true }
    );

    expect(report.error).toBeUndefined();
    expect(report.complianceFindings).toBeDefined();
    expect(report.complianceFindings.federalViolations.length).toBeGreaterThanOrEqual(1);

    const federalViol = report.complianceFindings.federalViolations.find(
      v => v.id === 'viol-enrich-001'
    );
    expect(federalViol).toBeDefined();

    // Source documents
    expect(federalViol.sourceDocuments).toBeDefined();
    expect(federalViol.sourceDocuments.length).toBeGreaterThanOrEqual(1);
    const docNames = federalViol.sourceDocuments.map(d => d.name);
    expect(docNames).toContain('monthly-statement-jan.pdf');

    // Supporting findings
    expect(federalViol.supportingFindings).toBeDefined();
    expect(federalViol.supportingFindings.length).toBeGreaterThanOrEqual(1);
    const findingQuotes = federalViol.supportingFindings.map(f => f.quotedText);
    expect(findingQuotes.some(q => q && q.includes('Escrow Balance'))).toBe(true);

    // Page references
    expect(federalViol.pageReferences).toBeDefined();
    expect(federalViol.pageReferences.length).toBeGreaterThanOrEqual(1);
    expect(federalViol.pageReferences.some(p => p.pageNumber === 2)).toBe(true);

    // State violation enrichment
    expect(report.complianceFindings.stateViolations.length).toBeGreaterThanOrEqual(1);
    const stateViol = report.complianceFindings.stateViolations.find(
      v => v.id === 'sviol-enrich-001'
    );
    expect(stateViol).toBeDefined();
    expect(stateViol.sourceDocuments).toBeDefined();
    expect(stateViol.sourceDocuments.length).toBeGreaterThanOrEqual(1);
    expect(stateViol.supportingFindings).toBeDefined();
    expect(stateViol.supportingFindings.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test (d): Evidence links quality — real quoted text, not template text
  // =========================================================================

  it('evidence links contain real quoted text and document references, not template text', async () => {
    const caseData = makeEnrichedCaseData();

    // Build the aggregated data shape that buildEvidenceLinks expects
    const aggregatedData = {
      documentAnalyses: caseData.documents.map(doc => {
        const report = doc.analysis_report;
        return {
          documentId: doc.document_id,
          documentName: report.documentInfo.fileName,
          anomalies: report.anomalies
        };
      }),
      forensicReport: caseData.forensic_analysis,
      complianceReport: caseData.compliance_report
    };

    const evidenceLinks = confidenceScoringService.buildEvidenceLinks(aggregatedData);

    expect(evidenceLinks).toBeDefined();
    expect(evidenceLinks.length).toBeGreaterThan(0);

    // --- Anomaly evidence links should use real quoted text ---
    const anomalyLinks = evidenceLinks.filter(l => l.findingType === 'anomaly');
    expect(anomalyLinks.length).toBeGreaterThanOrEqual(3);

    // At least one anomaly link should have real quoted text (not template)
    const enrichedAnomalyLinks = anomalyLinks.filter(l =>
      l.evidenceDescription && l.evidenceDescription.includes('Escrow Balance')
    );
    expect(enrichedAnomalyLinks.length).toBeGreaterThanOrEqual(1);

    // Enriched anomaly links should have sourceDocumentNames
    for (const link of enrichedAnomalyLinks) {
      expect(link.sourceDocumentNames).toBeDefined();
      expect(link.sourceDocumentNames.length).toBeGreaterThan(0);
    }

    // No anomaly link should contain the template placeholder text
    for (const link of anomalyLinks) {
      if (link.sourceDocumentNames) {
        expect(link.evidenceDescription).not.toContain('Document anomaly {id}');
      }
    }

    // --- Discrepancy evidence links should use per-document quoted text ---
    const discrepancyLinks = evidenceLinks.filter(l => l.findingType === 'discrepancy');
    expect(discrepancyLinks.length).toBeGreaterThanOrEqual(2);

    // At least one discrepancy link should have real document names
    const enrichedDiscLinks = discrepancyLinks.filter(l =>
      l.sourceDocumentNames && l.sourceDocumentNames.length > 0
    );
    expect(enrichedDiscLinks.length).toBeGreaterThanOrEqual(1);

    // Verify real text appears in discrepancy evidence
    const discWithEscrow = discrepancyLinks.find(l =>
      l.evidenceDescription && l.evidenceDescription.includes('Escrow')
    );
    expect(discWithEscrow).toBeDefined();
    expect(discWithEscrow.pageReferences).toBeDefined();
    expect(discWithEscrow.pageReferences.length).toBeGreaterThanOrEqual(1);

    // --- Federal violation evidence links should use source document names ---
    const federalLinks = evidenceLinks.filter(l => l.findingType === 'federalViolation');
    expect(federalLinks.length).toBeGreaterThanOrEqual(1);

    const enrichedFederalLink = federalLinks.find(l =>
      l.sourceDocumentNames && l.sourceDocumentNames.length > 0
    );
    expect(enrichedFederalLink).toBeDefined();
    expect(enrichedFederalLink.sourceDocumentNames).toContain('monthly-statement-jan.pdf');
    expect(enrichedFederalLink.pageReferences).toBeDefined();
    expect(enrichedFederalLink.pageReferences.length).toBeGreaterThanOrEqual(1);

    // Verify real quoted text in federal violation evidence
    expect(enrichedFederalLink.evidenceDescription).toContain('Escrow Balance');
  });

  // =========================================================================
  // Test (e): Report propagation — enriched evidence at all levels
  // =========================================================================

  it('consolidated report contains enriched evidence at all pipeline levels', async () => {
    caseFileService.getCase.mockResolvedValue(makeEnrichedCaseData());

    const report = await consolidatedReportService.generateReport(
      'case-enrich-001', 'user-enrich-001', { skipPersistence: true }
    );

    expect(report.error).toBeUndefined();

    // Level 1: documentAnalysis[].anomalies[].quotedText
    const doc1 = report.documentAnalysis.find(d => d.documentId === 'doc-enrich-001');
    expect(doc1.anomalies.some(a => a.quotedText != null)).toBe(true);
    expect(doc1.anomalies.some(a => a.pageReference != null)).toBe(true);
    expect(doc1.anomalies.some(a => a.sourceDocument != null)).toBe(true);

    // Level 2: forensicFindings.discrepancies[].documentA.quotedText
    const disc = report.forensicFindings.discrepancies.find(d => d.id === 'disc-enrich-001');
    expect(disc.documentA.quotedText).toBeDefined();
    expect(disc.documentA.quotedText.length).toBeGreaterThan(0);
    expect(disc.documentB.quotedText).toBeDefined();
    expect(disc.documentB.quotedText.length).toBeGreaterThan(0);

    // Level 3: complianceFindings.federalViolations[].sourceDocuments
    const viol = report.complianceFindings.federalViolations.find(
      v => v.id === 'viol-enrich-001'
    );
    expect(viol.sourceDocuments).toBeDefined();
    expect(viol.sourceDocuments.length).toBeGreaterThan(0);
    expect(viol.supportingFindings).toBeDefined();
    expect(viol.supportingFindings.length).toBeGreaterThan(0);

    // Level 4: evidenceLinks[].sourceDocumentNames
    expect(report.evidenceLinks).toBeDefined();
    expect(report.evidenceLinks.length).toBeGreaterThan(0);
    const linksWithDocNames = report.evidenceLinks.filter(
      l => l.sourceDocumentNames && l.sourceDocumentNames.length > 0
    );
    expect(linksWithDocNames.length).toBeGreaterThan(0);

    // Verify at least one evidence link has real page references
    const linksWithPages = report.evidenceLinks.filter(
      l => l.pageReferences && l.pageReferences.length > 0
    );
    expect(linksWithPages.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // Test: dispute letter extraction includes enriched evidence
  // =========================================================================

  it('dispute letter extraction methods include enriched evidence from consolidated report', () => {
    const caseData = makeEnrichedCaseData();

    // Build a consolidated-format report with enriched evidence
    const consolidatedReport = {
      caseSummary: {
        borrowerName: caseData.borrower_name,
        loanNumber: caseData.loan_number,
        propertyAddress: caseData.property_address,
        servicerName: caseData.servicer_name
      },
      documentAnalysis: caseData.documents.map(doc => ({
        documentId: doc.document_id,
        documentName: doc.analysis_report.documentInfo.fileName,
        anomalies: doc.analysis_report.anomalies
      })),
      forensicFindings: {
        discrepancies: caseData.forensic_analysis.discrepancies
      },
      complianceFindings: {
        federalViolations: caseData.compliance_report.violations,
        stateViolations: caseData.compliance_report.stateViolations
      }
    };

    // Test _extractViolations with enriched data
    const violations = disputeLetterService._extractViolations(consolidatedReport);
    expect(violations.length).toBeGreaterThanOrEqual(2);

    const federalViol = violations.find(v => v.type === 'federal');
    expect(federalViol.sourceDocuments).toBeDefined();
    expect(federalViol.sourceDocuments).toContain('monthly-statement-jan.pdf');
    expect(federalViol.quotedEvidence).toBeDefined();
    expect(federalViol.quotedEvidence.some(q => q.includes('Escrow Balance'))).toBe(true);
    expect(federalViol.pageReferences).toBeDefined();
    expect(federalViol.pageReferences.some(p => p.includes('page 2'))).toBe(true);

    // Test _extractFindings with enriched data
    const findings = disputeLetterService._extractFindings(consolidatedReport);
    expect(findings.length).toBeGreaterThanOrEqual(3); // 3 anomalies + 2 discrepancies

    // Anomaly findings should have evidence citations
    const anomalyFindings = findings.filter(f => f.type === 'anomaly');
    const citedAnomalies = anomalyFindings.filter(f => f.evidenceCitation);
    expect(citedAnomalies.length).toBeGreaterThanOrEqual(1);
    expect(citedAnomalies.some(f => f.evidenceCitation.includes('p.2'))).toBe(true);

    // Discrepancy findings should have evidence citations
    const discFindings = findings.filter(f => f.type === 'discrepancy');
    const citedDiscs = discFindings.filter(f => f.evidenceCitation);
    expect(citedDiscs.length).toBeGreaterThanOrEqual(1);
    expect(citedDiscs.some(f =>
      f.evidenceCitation.includes('monthly-statement-jan.pdf') &&
      f.evidenceCitation.includes('closing-disclosure.pdf')
    )).toBe(true);
  });
});
