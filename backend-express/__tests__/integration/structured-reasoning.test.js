/**
 * Structured Reasoning End-to-End Pipeline Integration Tests
 *
 * Verifies that structured reasoning fields (reasoningSteps, confidence,
 * confidenceLevel, confidenceExplanation) flow correctly through all five
 * analysis services and degrade gracefully when absent.
 *
 * Phase 52 final verification: all 5 reasoning enrichment plans are
 * exercised here across the full analysis pipeline.
 *
 * Mock strategy:
 *   - Anthropic SDK: mocked (returns structured reasoning in Claude responses)
 *   - Supabase: mocked (no database I/O)
 *   - caseFileService: mocked (returns synthetic case data)
 *   - All other services: REAL — documentAnalysisService, crossDocumentComparisonService,
 *     complianceAnalysisService, classificationService, and disputeLetterService run
 *     with actual logic so reasoning field propagation is verified end-to-end
 */

// ---------------------------------------------------------------------------
// Mocks — external I/O boundaries only
// ---------------------------------------------------------------------------

const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate }
  }));
});

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

// Set API key before services are loaded (some services read it at construction time)
process.env.ANTHROPIC_API_KEY = 'test-key-for-integration-tests';

// Load services after mocks are in place
const documentAnalysisService = require('../../services/documentAnalysisService');
const crossDocumentComparisonService = require('../../services/crossDocumentComparisonService');
const complianceAnalysisService = require('../../services/complianceAnalysisService');
const classificationService = require('../../services/classificationService');
const disputeLetterService = require('../../services/disputeLetterService');

// ---------------------------------------------------------------------------
// Helper — build a mock Anthropic response with reasoning fields
// ---------------------------------------------------------------------------

function mockAnthropicResponse(jsonBody) {
  return {
    content: [{ text: JSON.stringify(jsonBody) }],
    usage: { input_tokens: 500, output_tokens: 300 }
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Build a mock document analysis Claude response that includes
 * reasoningSteps and confidence on every anomaly.
 */
function makeAnalysisResponse() {
  return {
    extractedData: {
      dates: { statementDate: '2025-01-15', paymentDueDate: '2025-02-01' },
      amounts: { principalBalance: 245000, monthlyPayment: 1500 },
      rates: { interestRate: 4.5 },
      parties: { borrower: 'John Smith', servicer: 'First National Bank' },
      identifiers: { loanNumber: 'LN-SR-001' },
      terms: {},
      custom: {}
    },
    anomalies: [
      {
        field: 'escrowBalance',
        type: 'calculation_error',
        severity: 'high',
        description: 'Escrow balance does not reconcile with known disbursements',
        expectedValue: '1890.00',
        actualValue: '1245.00',
        pageNumber: 2,
        quotedText: 'Current Escrow Balance: $1,245.00',
        reasoningSteps: [
          'Step 1: Expected escrow balance based on prior statement and scheduled disbursements is $1,890.00',
          'Step 2: Document states current escrow balance is $1,245.00',
          'Step 3: Difference of $645.00 is not explained by any documented disbursement',
          'Step 4: This constitutes a calculation error or undisclosed disbursement'
        ],
        confidence: 0.92
      },
      {
        field: 'interestRate',
        type: 'inconsistency',
        severity: 'medium',
        description: 'Applied interest rate does not match stated contract rate',
        pageNumber: 3,
        quotedText: 'Interest Rate: 4.750% (calculated: 5.125%)',
        reasoningSteps: [
          'Step 1: Promissory note states fixed interest rate of 4.750%',
          'Step 2: Calculated effective rate from payment/balance is 5.125%',
          'Step 3: Discrepancy of 0.375% indicates potential overcharge'
        ],
        confidence: 0.78
      }
    ],
    summary: {
      overview: 'Monthly statement contains two significant anomalies suggesting potential servicing errors.',
      keyFindings: ['Escrow balance shortfall of $645', 'Interest rate discrepancy of 0.375%'],
      riskLevel: 'high',
      recommendations: ['Request itemized escrow history', 'Verify applied interest rate against note']
    }
  };
}

/**
 * Build a mock cross-document comparison Claude response that includes
 * reasoningSteps and confidence on every discrepancy.
 */
function makeComparisonResponse() {
  return {
    discrepancies: [
      {
        id: 'disc-001',
        type: 'amount_mismatch',
        severity: 'high',
        description: 'Escrow balance differs between monthly statement and closing disclosure',
        documentA: {
          documentId: 'doc-stmt-001',
          documentType: 'servicing',
          documentSubtype: 'monthly_statement',
          field: 'escrowBalance',
          value: '$1,245.00',
          pageNumber: 2,
          quotedText: 'Current Escrow Balance: $1,245.00'
        },
        documentB: {
          documentId: 'doc-cd-001',
          documentType: 'origination',
          documentSubtype: 'closing_disclosure',
          field: 'escrowBalance',
          value: '$1,890.00',
          pageNumber: 4,
          quotedText: 'Initial Escrow at Closing: $1,890.00'
        },
        regulation: 'RESPA Section 10',
        reasoningSteps: [
          'Step 1: Document A states escrow balance as $1,245.00 at statement date',
          'Step 2: Document B (closing disclosure) established initial escrow of $1,890.00',
          'Step 3: Without documented disbursements, the $645 reduction is unexplained',
          'Step 4: This pattern is consistent with undisclosed escrow disbursement or misapplication'
        ],
        confidence: 0.88
      }
    ],
    timelineEvents: [],
    timelineViolations: [],
    comparisonSummary: 'One high-severity escrow discrepancy found between statement and closing disclosure.'
  };
}

/**
 * Build a mock compliance analysis Claude response that includes
 * reasoningSteps and confidence for each violation enhancement.
 */
function makeComplianceResponse() {
  return {
    enhancedViolations: [
      {
        index: 0,
        detailedLegalBasis: 'RESPA Section 6(g) requires servicers to maintain escrow accounts in accordance with 12 CFR 1024.17. The $645 shortfall constitutes a failure to properly maintain required escrow balances, which directly harms the borrower by creating artificial shortage.',
        potentialPenalties: 'Actual damages plus statutory damages up to $2,000 per violation under 12 USC 2605(f)',
        recommendations: [
          'File a QWR demanding itemized escrow history',
          'Request escrow analysis for past 24 months',
          'File complaint with CFPB if servicer fails to respond within 30 days'
        ],
        regulatoryImplications: 'Potential pattern of escrow mismanagement violating RESPA Section 10 annual escrow accounting requirements',
        reasoningSteps: [
          'Step 1: RESPA Section 10 (12 USC 2609) prohibits excessive escrow charges and requires accurate account maintenance',
          'Step 2: A $645 unexplained reduction in escrow balance violates the statutory maintenance requirement',
          'Step 3: The servicer has failed to provide an accounting that reconciles the discrepancy',
          'Step 4: Legal consequence: borrower may claim actual damages plus statutory damages under 12 USC 2605(f)'
        ],
        confidence: 0.89
      }
    ]
  };
}

/**
 * Build a mock classification Claude response with reasoning fields.
 */
function makeClassificationResponse() {
  return {
    classificationType: 'servicing',
    classificationSubtype: 'monthly_statement',
    confidence: 0.95,
    extractedMetadata: {
      dates: ['2025-01-15'],
      amounts: ['$1,500.00'],
      parties: ['First National Bank'],
      accountNumbers: ['****1234'],
      propertyAddress: '123 Main St, Springfield, IL 62701'
    },
    reasoning: 'Document contains standard mortgage statement elements including payment history, escrow analysis, and servicer contact information.',
    reasoningSteps: [
      'Step 1: Analyzed document layout — contains "Monthly Mortgage Statement" header and servicer letterhead',
      'Step 2: Identified key features: payment breakdown (P&I + escrow), running balance, payment due date',
      'Step 3: Features match "monthly_statement" subtype in servicing category with high confidence',
      'Step 4: No ambiguous features detected — single dominant classification'
    ],
    confidenceExplanation: 'All major monthly_statement features present with no competing document type indicators.'
  };
}

/**
 * Build a mock dispute letter Claude response.
 */
function makeDisputeLetterResponse() {
  return {
    subject: 'QUALIFIED WRITTEN REQUEST UNDER RESPA SECTION 6 — Loan No. LN-SR-001',
    salutation: 'Dear First National Bank Servicing Department,',
    body: 'I am writing to dispute errors in the servicing of my mortgage account. The evidence demonstrates (confidence: high) that the servicer failed to properly maintain my escrow account, resulting in an unexplained shortfall of $645.00. The records demonstrate a clear violation of RESPA Section 10 requirements for escrow account maintenance.',
    demands: [
      'Provide a complete itemized escrow account history for the past 24 months',
      'Explain the $645 reduction in escrow balance from $1,890 to $1,245',
      'Correct any misapplied payments and provide corrected account statements'
    ],
    legalCitations: ['RESPA Section 6, 12 U.S.C. § 2605(e)', 'RESPA Section 10, 12 U.S.C. § 2609'],
    responseDeadline: 'You must acknowledge this request within 5 business days and provide a substantive response within 30 business days pursuant to 12 U.S.C. § 2605(e).',
    closingStatement: 'If you fail to respond as required, I reserve all legal rights under RESPA including claims for actual damages, statutory damages, costs, and attorney fees.'
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Ensure ANTHROPIC_API_KEY is set so lazy-init services don't throw
  process.env.ANTHROPIC_API_KEY = 'test-key-for-integration-tests';
});

describe('Structured Reasoning End-to-End Pipeline', () => {

  // =========================================================================
  // Test 1: documentAnalysisService produces anomalies with reasoning fields
  // =========================================================================

  it('documentAnalysisService produces anomalies with reasoningSteps, confidence, and confidenceLevel', async () => {
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse(makeAnalysisResponse()));

    const documentText = 'MONTHLY MORTGAGE STATEMENT\nLoan Number: LN-SR-001\nBorrower: John Smith\nEscrow Balance: $1,245.00\nInterest Rate: 4.750%\nMonthly Payment: $1,500.00';

    const classification = {
      classificationType: 'servicing',
      classificationSubtype: 'monthly_statement',
      confidence: 0.95
    };

    const result = await documentAnalysisService.analyzeDocument(documentText, classification);

    expect(result.error).toBeUndefined();
    expect(result.anomalies).toBeDefined();
    expect(result.anomalies.length).toBeGreaterThanOrEqual(2);

    // Verify first anomaly has reasoning fields
    const anomaly1 = result.anomalies.find(a => a.field === 'escrowBalance');
    expect(anomaly1).toBeDefined();
    expect(Array.isArray(anomaly1.reasoningSteps)).toBe(true);
    expect(anomaly1.reasoningSteps.length).toBeGreaterThanOrEqual(1);
    expect(anomaly1.reasoningSteps[0]).toContain('escrow');
    expect(typeof anomaly1.confidence).toBe('number');
    expect(anomaly1.confidence).toBeGreaterThanOrEqual(0);
    expect(anomaly1.confidence).toBeLessThanOrEqual(1);
    expect(anomaly1.confidenceLevel).toBe('high'); // 0.92 >= 0.85 threshold

    // Verify second anomaly with medium confidence
    const anomaly2 = result.anomalies.find(a => a.field === 'interestRate');
    expect(anomaly2).toBeDefined();
    expect(Array.isArray(anomaly2.reasoningSteps)).toBe(true);
    expect(anomaly2.reasoningSteps.length).toBeGreaterThanOrEqual(1);
    expect(typeof anomaly2.confidence).toBe('number');
    expect(anomaly2.confidenceLevel).toBe('medium'); // 0.78 in [0.50, 0.85)
  });

  // =========================================================================
  // Test 2: crossDocumentComparisonService produces discrepancies with reasoning fields
  // =========================================================================

  it('crossDocumentComparisonService produces discrepancies with reasoningSteps and confidence', async () => {
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse(makeComparisonResponse()));

    const docA = {
      documentId: 'doc-stmt-001',
      documentType: 'servicing',
      documentSubtype: 'monthly_statement',
      documentName: 'monthly-statement-jan.pdf',
      extractedData: {
        amounts: { escrowBalance: 1245.00 },
        dates: { statementDate: '2025-01-15' }
      },
      anomalies: []
    };

    const docB = {
      documentId: 'doc-cd-001',
      documentType: 'origination',
      documentSubtype: 'closing_disclosure',
      documentName: 'closing-disclosure.pdf',
      extractedData: {
        amounts: { escrowBalance: 1890.00 },
        dates: { closingDate: '2024-03-20' }
      },
      anomalies: []
    };

    const comparisonConfig = {
      pairId: 'stmt-vs-cd',
      comparisonFields: ['amounts', 'dates'],
      discrepancyTypes: ['amount_mismatch', 'date_inconsistency'],
      forensicSignificance: 'high'
    };

    const result = await crossDocumentComparisonService.compareDocumentPair(docA, docB, comparisonConfig);

    expect(result.error).toBeUndefined();
    expect(result.discrepancies).toBeDefined();
    expect(result.discrepancies.length).toBeGreaterThanOrEqual(1);

    const disc = result.discrepancies.find(d => d.id === 'disc-001');
    expect(disc).toBeDefined();

    // Verify reasoning fields are present on discrepancy
    expect(Array.isArray(disc.reasoningSteps)).toBe(true);
    expect(disc.reasoningSteps.length).toBeGreaterThanOrEqual(1);
    expect(disc.reasoningSteps[0]).toContain('Document A');
    expect(typeof disc.confidence).toBe('number');
    expect(disc.confidence).toBeGreaterThanOrEqual(0);
    expect(disc.confidence).toBeLessThanOrEqual(1);
    expect(disc.confidenceLevel).toBe('high'); // 0.88 >= 0.85 threshold
  });

  // =========================================================================
  // Test 3: complianceAnalysisService produces violations with reasoning fields
  // =========================================================================

  it('complianceAnalysisService produces violations with reasoningSteps and confidence', async () => {
    // First call: violation enhancement; second call: legal narrative
    mockAnthropicCreate
      .mockResolvedValueOnce(mockAnthropicResponse(makeComplianceResponse()))
      .mockResolvedValueOnce({
        content: [{ text: '## Legal Analysis\n\nThis case involves RESPA escrow violations requiring immediate action.' }],
        usage: { input_tokens: 200, output_tokens: 100 }
      });

    const violations = [
      {
        id: 'viol-001',
        statuteId: 'respa',
        sectionId: 'respa_s10_escrow',
        statuteName: 'Real Estate Settlement Procedures Act',
        sectionTitle: 'Escrow Account Maintenance',
        citation: '12 USC 2609; 12 CFR 1024.17',
        severity: 'high',
        description: 'Servicer failed to maintain accurate escrow account records',
        evidence: [
          { sourceType: 'anomaly', sourceId: 'anom-001', description: 'Escrow balance shortfall of $645' }
        ],
        legalBasis: 'RESPA Section 10 requires accurate escrow account maintenance'
      }
    ];

    const caseContext = {
      caseId: 'case-sr-001',
      documentTypes: ['servicing', 'origination'],
      discrepancySummary: '1 high-severity escrow discrepancy'
    };

    const result = await complianceAnalysisService.analyzeViolations(violations, caseContext);

    expect(result.enhancedViolations).toBeDefined();
    expect(result.enhancedViolations.length).toBe(1);

    const enhanced = result.enhancedViolations[0];

    // Verify reasoning fields are present on enhanced violation
    expect(Array.isArray(enhanced.reasoningSteps)).toBe(true);
    expect(enhanced.reasoningSteps.length).toBeGreaterThanOrEqual(1);
    expect(enhanced.reasoningSteps[0]).toContain('RESPA');
    expect(typeof enhanced.confidence).toBe('number');
    expect(enhanced.confidence).toBeGreaterThanOrEqual(0);
    expect(enhanced.confidence).toBeLessThanOrEqual(1);
    expect(enhanced.confidenceLevel).toBe('high'); // 0.89 >= 0.85 threshold

    // Verify other enhancement fields are present
    expect(enhanced.legalBasis).toContain('RESPA');
    expect(Array.isArray(enhanced.recommendations)).toBe(true);
    expect(enhanced.recommendations.length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 4: classificationService produces structured reasoning fields
  // =========================================================================

  it('classificationService produces reasoningSteps array and confidenceExplanation', async () => {
    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse(makeClassificationResponse()));

    const documentText = 'MONTHLY MORTGAGE STATEMENT\nFirst National Bank\nLoan Number: LN-SR-001\nBorrower: John Smith\nStatement Date: January 15, 2025\nMonthly Payment: $1,500.00';

    const result = await classificationService.classifyDocument(documentText);

    expect(result.parseError).toBeUndefined();
    expect(result.classificationType).toBe('servicing');
    expect(result.classificationSubtype).toBe('monthly_statement');

    // Verify reasoning fields are present
    expect(Array.isArray(result.reasoningSteps)).toBe(true);
    expect(result.reasoningSteps.length).toBeGreaterThanOrEqual(1);
    expect(result.reasoningSteps[0]).toContain('Step 1');
    expect(result.confidenceExplanation).toBeDefined();
    expect(typeof result.confidenceExplanation).toBe('string');
    expect(result.confidenceExplanation.length).toBeGreaterThan(0);

    // Verify confidence level is assigned
    expect(result.confidence).toBe(0.95);
    expect(result.confidenceLevel).toBe('high'); // 0.95 >= 0.7 threshold in classificationService
  });

  // =========================================================================
  // Test 5: disputeLetterService includes confidence context when violations
  //         have confidence scores
  // =========================================================================

  it('disputeLetterService includes confidence context in prompt when violations have confidence scores', async () => {
    let capturedPrompt = null;

    mockAnthropicCreate.mockImplementation(async (params) => {
      capturedPrompt = params.messages[0].content;
      return mockAnthropicResponse(makeDisputeLetterResponse());
    });

    const consolidatedReport = {
      caseSummary: {
        borrowerName: 'John Smith',
        loanNumber: 'LN-SR-001',
        propertyAddress: '123 Main St, Springfield, IL 62701',
        servicerName: 'First National Bank',
        servicerAddress: '456 Bank Ave, Chicago, IL 60601'
      },
      documentAnalysis: [],
      forensicFindings: {
        discrepancies: []
      },
      complianceFindings: {
        federalViolations: [
          {
            id: 'viol-001',
            statuteId: 'respa',
            sectionId: 'respa_s10_escrow',
            statuteName: 'Real Estate Settlement Procedures Act',
            sectionTitle: 'Escrow Account Maintenance',
            citation: '12 USC 2609',
            severity: 'high',
            description: 'Servicer failed to maintain accurate escrow account records',
            legalBasis: 'RESPA Section 10 requires accurate escrow account maintenance',
            // Reasoning/confidence fields from Phase 52
            confidence: 0.89,
            confidenceLevel: 'high',
            reasoningSteps: [
              'RESPA Section 10 requires accurate escrow maintenance',
              'Escrow balance shows $645 unexplained reduction',
              'No documented disbursement accounts for this reduction'
            ]
          }
        ],
        stateViolations: []
      }
    };

    process.env.ANTHROPIC_API_KEY = 'test-key';
    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      consolidatedReport
    );

    expect(result.error).toBeUndefined(); // if true, check result.errorMessage
    expect(result.letterType).toBe('qualified_written_request');
    expect(result.content).toBeDefined();

    // Verify the prompt included confidence context section
    expect(capturedPrompt).toBeDefined();
    expect(capturedPrompt).toContain('Analysis Confidence Context');
    expect(capturedPrompt).toContain('confidence');
    expect(capturedPrompt).toContain('Real Estate Settlement Procedures Act');
  });

  // =========================================================================
  // Test 6: pipeline handles mixed enrichment levels gracefully
  //         (some findings have reasoning, some don't — no errors)
  // =========================================================================

  it('pipeline handles mixed reasoning enrichment gracefully (no errors, defaults applied)', async () => {
    // Response with one anomaly having reasoning and one without
    const mixedAnalysisResponse = {
      extractedData: {
        dates: { statementDate: '2025-01-15' },
        amounts: { principalBalance: 245000 },
        rates: { interestRate: 4.5 },
        parties: { borrower: 'Jane Doe' },
        identifiers: { loanNumber: 'LN-MIX-001' },
        terms: {},
        custom: {}
      },
      anomalies: [
        {
          field: 'escrowBalance',
          type: 'calculation_error',
          severity: 'high',
          description: 'Escrow balance is lower than expected',
          // WITH reasoning — should be preserved
          reasoningSteps: [
            'Step 1: Expected $1,890 based on prior data',
            'Step 2: Found $1,245 in document',
            'Step 3: Difference unexplained'
          ],
          confidence: 0.91
        },
        {
          field: 'lateCharges',
          type: 'unusual_value',
          severity: 'medium',
          description: 'Late charge amount appears inconsistent with loan terms',
          // WITHOUT reasoning — should default to empty array / null
          // (no reasoningSteps or confidence in this anomaly)
        }
      ],
      summary: {
        overview: 'Mixed enrichment test document.',
        keyFindings: ['Escrow balance issue', 'Late charge concern'],
        riskLevel: 'medium',
        recommendations: ['Review escrow history']
      }
    };

    mockAnthropicCreate.mockResolvedValue(mockAnthropicResponse(mixedAnalysisResponse));

    const documentText = 'MONTHLY MORTGAGE STATEMENT\nLoan: LN-MIX-001\nBorrower: Jane Doe';
    const classification = {
      classificationType: 'servicing',
      classificationSubtype: 'monthly_statement',
      confidence: 0.9
    };

    const result = await documentAnalysisService.analyzeDocument(documentText, classification);

    expect(result.error).toBeUndefined();
    expect(result.anomalies).toBeDefined();
    expect(result.anomalies.length).toBe(2);

    // Anomaly WITH reasoning — should retain values
    const withReasoning = result.anomalies.find(a => a.field === 'escrowBalance');
    expect(withReasoning).toBeDefined();
    expect(Array.isArray(withReasoning.reasoningSteps)).toBe(true);
    expect(withReasoning.reasoningSteps.length).toBe(3);
    expect(typeof withReasoning.confidence).toBe('number');
    expect(withReasoning.confidence).toBe(0.91);
    expect(withReasoning.confidenceLevel).toBe('high');

    // Anomaly WITHOUT reasoning — should default cleanly (no error)
    const withoutReasoning = result.anomalies.find(a => a.field === 'lateCharges');
    expect(withoutReasoning).toBeDefined();
    expect(Array.isArray(withoutReasoning.reasoningSteps)).toBe(true);
    expect(withoutReasoning.reasoningSteps.length).toBe(0); // default empty array
    expect(withoutReasoning.confidence).toBeNull();         // default null
    expect(withoutReasoning.confidenceLevel).toBeNull();    // default null

    // Verify Joi schemas accept reasoning fields with and without values — no validation errors
    // for the reasoning fields themselves (other enriched fields like pageReference are not
    // part of analysisReportSchema — that schema validates API responses, not service output)
    const { validateCrossDocumentAnalysis } = require('../../schemas/crossDocumentAnalysisSchema');
    const crossDocResult = validateCrossDocumentAnalysis({
      caseId: 'case-sr-001',
      analyzedAt: new Date().toISOString(),
      documentsAnalyzed: 2,
      comparisonPairsEvaluated: 1,
      discrepancies: [
        {
          id: 'disc-001',
          type: 'amount_mismatch',
          severity: 'high',
          description: 'Test discrepancy with reasoning',
          documentA: { documentId: 'doc-a', documentType: 'servicing', documentSubtype: 'monthly_statement', field: 'escrowBalance', value: 1245 },
          documentB: { documentId: 'doc-b', documentType: 'origination', documentSubtype: 'closing_disclosure', field: 'escrowBalance', value: 1890 },
          // With reasoning
          reasoningSteps: ['Step 1: found discrepancy', 'Step 2: calculated difference'],
          confidence: 0.91,
          confidenceLevel: 'high'
        },
        {
          id: 'disc-002',
          type: 'date_inconsistency',
          severity: 'medium',
          description: 'Test discrepancy without reasoning',
          documentA: { documentId: 'doc-a', documentType: 'servicing', documentSubtype: 'monthly_statement', field: 'statementDate', value: '2025-01-15' },
          documentB: { documentId: 'doc-b', documentType: 'origination', documentSubtype: 'closing_disclosure', field: 'closingDate', value: '2025-01-20' }
          // No reasoning fields — should use defaults
        }
      ],
      timeline: { events: [], violations: [] },
      summary: {
        totalDiscrepancies: 2,
        criticalFindings: 0,
        highFindings: 1,
        riskLevel: 'medium',
        keyFindings: [],
        recommendations: []
      }
    });

    expect(crossDocResult.error).toBeUndefined();

    // The second discrepancy should have defaults applied (empty array, null)
    const disc2 = crossDocResult.value.discrepancies.find(d => d.id === 'disc-002');
    expect(disc2).toBeDefined();
    expect(Array.isArray(disc2.reasoningSteps)).toBe(true);
    expect(disc2.reasoningSteps.length).toBe(0);
    expect(disc2.confidence).toBeNull();
    expect(disc2.confidenceLevel).toBeNull();
  });

});
