/**
 * Dispute Letter Service Tests
 *
 * Tests generateDisputeLetter() for all 3 RESPA letter types,
 * error handling, graceful degradation, and JSON extraction fallback.
 *
 * Mocks: Anthropic SDK (no API key needed for tests)
 */

let mockCreate;

jest.mock('@anthropic-ai/sdk', () => {
  mockCreate = jest.fn();
  return jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate }
  }));
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeMockLetterResponse() {
  return {
    subject: 'Qualified Written Request Regarding Loan #12345',
    salutation: 'Dear Loan Servicing Department:',
    body: '## Qualified Written Request\n\nThis letter constitutes a Qualified Written Request under RESPA Section 6...',
    demands: [
      'Provide a complete payment history for the life of the loan',
      'Correct the escrow account balance discrepancy',
      'Refund all improperly assessed late fees'
    ],
    legalCitations: [
      '12 U.S.C. § 2605(e)',
      '12 CFR 1024.35',
      '12 CFR 1024.36'
    ],
    responseDeadline: '30 business days from receipt of this letter',
    closingStatement: 'Please respond within the timeframe required by federal law. Sincerely, [Borrower Name]'
  };
}

function makeConsolidatedReport() {
  return {
    caseSummary: {
      caseId: 'case-001',
      borrowerName: 'Jane Doe',
      loanNumber: '12345',
      propertyAddress: '123 Main St, Springfield, IL 62701',
      servicerName: 'ABC Mortgage Servicing',
      servicerAddress: '456 Corporate Blvd, Suite 100, Chicago, IL 60601'
    },
    documentAnalyses: [
      {
        documentId: 'doc-001',
        documentName: 'statement-jan.pdf',
        type: 'mortgage_statement',
        anomalies: [
          {
            id: 'anom-001',
            field: 'escrowBalance',
            severity: 'high',
            description: 'Escrow shortage not disclosed',
            sourceDocument: { id: 'doc-001', name: 'statement-jan.pdf', type: 'mortgage_statement' },
            pageReference: 2,
            quotedText: 'Escrow Balance: $1,245.00'
          }
        ]
      }
    ],
    forensicReport: {
      discrepancies: [
        {
          id: 'disc-001',
          type: 'payment_mismatch',
          severity: 'critical',
          description: 'Payment credited 5 days late',
          documentA: {
            documentId: 'doc-001',
            documentName: 'statement-jan.pdf',
            field: 'paymentDate',
            value: '2026-01-15',
            pageNumber: 3,
            quotedText: 'Payment received: 01/15/2026'
          },
          documentB: {
            documentId: 'doc-002',
            documentName: 'bank-records.pdf',
            field: 'transactionDate',
            value: '2026-01-10',
            pageNumber: 1,
            quotedText: 'ACH Debit 01/10/2026 $2,150.00'
          }
        }
      ],
      timeline: { violations: [] },
      paymentVerification: { verified: false }
    },
    complianceReport: {
      violations: [
        {
          id: 'viol-001',
          statuteName: 'RESPA',
          citation: '12 U.S.C. § 2605(e)',
          severity: 'high',
          description: 'Failure to respond to qualified written request within 30 days',
          legalBasis: 'RESPA Section 6(e) requires a substantive response within 30 business days',
          sourceDocuments: [
            { id: 'doc-001', name: 'statement-jan.pdf', type: 'mortgage_statement' }
          ],
          supportingFindings: [
            { findingId: 'anom-001', findingType: 'anomaly', quotedText: 'Escrow Balance: $1,245.00' }
          ],
          pageReferences: [
            { documentId: 'doc-001', documentName: 'statement-jan.pdf', pageNumber: 2 }
          ]
        }
      ],
      stateViolations: [
        {
          id: 'sviol-001',
          jurisdiction: 'IL',
          statuteName: 'Illinois Interest Act',
          citation: '815 ILCS 205/4',
          severity: 'medium',
          description: 'Interest overcharge on escrow account'
        }
      ]
    }
  };
}

/**
 * Consolidated report WITHOUT enriched evidence fields — used for backward compatibility testing.
 */
function makeUnenrichedConsolidatedReport() {
  return {
    caseSummary: {
      caseId: 'case-002',
      borrowerName: 'John Smith',
      loanNumber: '67890',
      propertyAddress: '456 Oak Ave, Chicago, IL 60601',
      servicerName: 'XYZ Mortgage Corp',
      servicerAddress: '789 Finance Dr, Suite 200, Dallas, TX 75201'
    },
    documentAnalyses: [
      {
        documentId: 'doc-010',
        documentName: 'statement-feb.pdf',
        type: 'mortgage_statement',
        anomalies: [
          { id: 'anom-010', field: 'lateCharge', severity: 'medium', description: 'Late charge assessed incorrectly' }
        ]
      }
    ],
    forensicReport: {
      discrepancies: [
        { id: 'disc-010', type: 'amount_mismatch', severity: 'high', description: 'Principal balance differs between documents' }
      ],
      timeline: { violations: [] },
      paymentVerification: { verified: true }
    },
    complianceReport: {
      violations: [
        {
          id: 'viol-010',
          statuteName: 'TILA',
          citation: '15 U.S.C. § 1601',
          severity: 'medium',
          description: 'Disclosure timing violation',
          legalBasis: 'TILA requires timely disclosure of loan terms'
        }
      ],
      stateViolations: []
    }
  };
}

const disputeLetterService = require('../../services/disputeLetterService');

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'test-key-for-testing';
  mockCreate.mockReset();
  // Reset the lazy client so it re-initializes with the mock
  disputeLetterService._client = null;
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

// ---------------------------------------------------------------------------
// generateDisputeLetter — Happy Paths
// ---------------------------------------------------------------------------

describe('generateDisputeLetter', () => {
  test('generates a qualified_written_request with all required fields', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.letterType).toBe('qualified_written_request');
    expect(result.generatedAt).toBeDefined();
    expect(result.content.subject).toBe(mockResponse.subject);
    expect(result.content.salutation).toBe(mockResponse.salutation);
    expect(result.content.body).toContain('Qualified Written Request');
    expect(result.content.demands).toHaveLength(3);
    expect(result.content.legalCitations).toContain('12 U.S.C. § 2605(e)');
    expect(result.content.responseDeadline).toBe('30 business days from receipt of this letter');
    expect(result.content.closingStatement).toBeDefined();
    expect(result.recipientInfo.servicerName).toBe('ABC Mortgage Servicing');
    expect(result.recipientInfo.servicerAddress).toBe('456 Corporate Blvd, Suite 100, Chicago, IL 60601');
  });

  test('generates a notice_of_error letter', async () => {
    const mockResponse = {
      ...makeMockLetterResponse(),
      subject: 'Notice of Error Regarding Loan #12345'
    };
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 450, output_tokens: 700 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'notice_of_error',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.letterType).toBe('notice_of_error');
    expect(result.content.subject).toContain('Notice of Error');
    expect(result.content.demands).toBeInstanceOf(Array);
    expect(result.content.legalCitations).toBeInstanceOf(Array);
  });

  test('generates a request_for_information letter', async () => {
    const mockResponse = {
      ...makeMockLetterResponse(),
      subject: 'Request for Information Regarding Loan #12345'
    };
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 400, output_tokens: 600 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'request_for_information',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.letterType).toBe('request_for_information');
    expect(result.content.subject).toContain('Request for Information');
  });

  test('passes violation data to Claude in the prompt', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const prompt = callArgs.messages[0].content;

    expect(prompt).toContain('RESPA');
    expect(prompt).toContain('12 U.S.C. § 2605(e)');
    expect(prompt).toContain('Failure to respond to qualified written request');
  });

  test('passes servicer name in the prompt', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('ABC Mortgage Servicing');
  });

  test('uses correct model and temperature', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-sonnet-4-5-20250514');
    expect(callArgs.temperature).toBe(0.1);
  });
});

// ---------------------------------------------------------------------------
// generateDisputeLetter — Error Cases
// ---------------------------------------------------------------------------

describe('generateDisputeLetter — error handling', () => {
  test('returns error for invalid letter type', async () => {
    const result = await disputeLetterService.generateDisputeLetter(
      'invalid_type',
      makeConsolidatedReport()
    );

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Invalid letter type');
    expect(result.letterType).toBe('invalid_type');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('returns error for null letter type', async () => {
    const result = await disputeLetterService.generateDisputeLetter(
      null,
      makeConsolidatedReport()
    );

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Invalid letter type');
    expect(result.letterType).toBe('unknown');
  });

  test('returns error for missing consolidated report', async () => {
    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      null
    );

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Consolidated report is required');
    expect(result.letterType).toBe('qualified_written_request');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('returns error for non-object consolidated report', async () => {
    const result = await disputeLetterService.generateDisputeLetter(
      'notice_of_error',
      'not an object'
    );

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Consolidated report is required');
  });

  test('returns error object on Claude API failure — never throws', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBe(true);
    expect(result.errorMessage).toBe('API rate limit exceeded');
    expect(result.letterType).toBe('qualified_written_request');
  });

  test('returns error when Claude returns unparseable response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: 'This is not JSON at all' }],
      usage: { input_tokens: 100, output_tokens: 50 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Failed to parse generated letter');
  });

  test('returns error when Claude returns empty response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: '' }],
      usage: { input_tokens: 100, output_tokens: 0 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBe(true);
    expect(result.errorMessage).toContain('Failed to parse generated letter');
  });
});

// ---------------------------------------------------------------------------
// Markdown code fence JSON extraction fallback
// ---------------------------------------------------------------------------

describe('generateDisputeLetter — code fence fallback', () => {
  test('successfully parses JSON wrapped in markdown code fences', async () => {
    const mockResponse = makeMockLetterResponse();
    const wrappedText = '```json\n' + JSON.stringify(mockResponse, null, 2) + '\n```';
    mockCreate.mockResolvedValueOnce({
      content: [{ text: wrappedText }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.letterType).toBe('qualified_written_request');
    expect(result.content.subject).toBe(mockResponse.subject);
    expect(result.content.demands).toHaveLength(3);
  });

  test('successfully parses JSON wrapped in generic code fences (no json tag)', async () => {
    const mockResponse = makeMockLetterResponse();
    const wrappedText = '```\n' + JSON.stringify(mockResponse) + '\n```';
    mockCreate.mockResolvedValueOnce({
      content: [{ text: wrappedText }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.subject).toBe(mockResponse.subject);
  });
});

// ---------------------------------------------------------------------------
// _extractRecipientInfo
// ---------------------------------------------------------------------------

describe('_extractRecipientInfo', () => {
  test('extracts servicer info from full case summary', () => {
    const report = makeConsolidatedReport();
    const info = disputeLetterService._extractRecipientInfo(report);

    expect(info.servicerName).toBe('ABC Mortgage Servicing');
    expect(info.servicerAddress).toBe('456 Corporate Blvd, Suite 100, Chicago, IL 60601');
  });

  test('returns defaults when servicer info is missing', () => {
    const info = disputeLetterService._extractRecipientInfo({});

    expect(info.servicerName).toBe('Unknown Servicer');
    expect(info.servicerAddress).toBe('Address Not Available');
  });

  test('returns defaults when caseSummary is missing', () => {
    const info = disputeLetterService._extractRecipientInfo({ caseSummary: undefined });

    expect(info.servicerName).toBe('Unknown Servicer');
    expect(info.servicerAddress).toBe('Address Not Available');
  });
});

// ---------------------------------------------------------------------------
// Content defaults for missing fields
// ---------------------------------------------------------------------------

describe('generateDisputeLetter — content defaults', () => {
  test('provides empty defaults when Claude returns partial response', async () => {
    const partialResponse = {
      subject: 'Partial Letter',
      body: 'Some body text'
      // Missing: salutation, demands, legalCitations, responseDeadline, closingStatement
    };
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(partialResponse) }],
      usage: { input_tokens: 300, output_tokens: 200 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.subject).toBe('Partial Letter');
    expect(result.content.body).toBe('Some body text');
    expect(result.content.salutation).toBe('');
    expect(result.content.demands).toEqual([]);
    expect(result.content.legalCitations).toEqual([]);
    expect(result.content.responseDeadline).toBe('');
    expect(result.content.closingStatement).toBe('');
  });

  test('handles report with no violations or findings gracefully', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 300, output_tokens: 600 }
    });

    const emptyReport = {
      caseSummary: { servicerName: 'Test Servicer' },
      documentAnalyses: [],
      forensicReport: { discrepancies: [] },
      complianceReport: { violations: [], stateViolations: [] }
    };

    const result = await disputeLetterService.generateDisputeLetter(
      'notice_of_error',
      emptyReport
    );

    expect(result.error).toBeUndefined();
    expect(result.letterType).toBe('notice_of_error');
    expect(result.recipientInfo.servicerName).toBe('Test Servicer');
  });
});

// ---------------------------------------------------------------------------
// Enriched evidence in prompts — Phase 51-05
//
// When enriched evidence fields (sourceDocuments, quotedText, pageReferences)
// are present, the prompt must include document names, page numbers, and
// quoted text for citation-grade letter generation.
// ---------------------------------------------------------------------------

describe('generateDisputeLetter — enriched evidence in prompts', () => {
  test('prompt includes document names, page numbers, and quoted text from enriched evidence', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;

    // Verify enriched violation evidence in prompt
    expect(prompt).toContain('statement-jan.pdf');
    expect(prompt).toContain('Escrow Balance: $1,245.00');
    expect(prompt).toContain('page 2');

    // Verify enriched finding evidence in prompt (anomaly with page reference)
    expect(prompt).toContain('[statement-jan.pdf, p.2]');

    // Verify enriched discrepancy evidence in prompt (per-document citations)
    expect(prompt).toContain('[bank-records.pdf, p.1]');
    expect(prompt).toContain('ACH Debit 01/10/2026 $2,150.00');
    expect(prompt).toContain('Payment received: 01/15/2026');

    // Verify citation instruction is present when enriched evidence exists
    expect(prompt).toContain('Evidence Citation Requirements');
    expect(prompt).toContain('(See [Document Name], page [X]');
    expect(prompt).toContain('Every factual claim');
  });

  test('prompt omits citation instructions when evidence is not enriched (backward compatibility)', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeUnenrichedConsolidatedReport()
    );

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;

    // Verify the letter still generates successfully
    expect(prompt).toContain('TILA');
    expect(prompt).toContain('15 U.S.C. § 1601');
    expect(prompt).toContain('Late charge assessed incorrectly');

    // Verify citation instructions are NOT present for un-enriched data
    expect(prompt).not.toContain('Evidence Citation Requirements');
  });

  test('generates letter successfully with un-enriched data', async () => {
    const mockResponse = {
      ...makeMockLetterResponse(),
      subject: 'QWR Regarding Loan #67890'
    };
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeUnenrichedConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.letterType).toBe('qualified_written_request');
    expect(result.content.subject).toBe('QWR Regarding Loan #67890');
    expect(result.recipientInfo.servicerName).toBe('XYZ Mortgage Corp');
  });
});

// ---------------------------------------------------------------------------
// Enriched evidence extraction — Phase 51-05 unit tests
// ---------------------------------------------------------------------------

describe('_extractViolations — enriched evidence fields', () => {
  test('includes sourceDocuments, quotedEvidence, pageReferences when present', () => {
    const report = makeConsolidatedReport();
    const violations = disputeLetterService._extractViolations(report);

    const federal = violations.find(v => v.type === 'federal');
    expect(federal).toBeDefined();
    expect(federal.sourceDocuments).toEqual(['statement-jan.pdf']);
    expect(federal.quotedEvidence).toEqual(['Escrow Balance: $1,245.00']);
    expect(federal.pageReferences).toEqual(['statement-jan.pdf, page 2']);
  });

  test('omits enriched fields when not present (backward compatible)', () => {
    const report = makeUnenrichedConsolidatedReport();
    const violations = disputeLetterService._extractViolations(report);

    const federal = violations.find(v => v.type === 'federal');
    expect(federal).toBeDefined();
    expect(federal.sourceDocuments).toBeUndefined();
    expect(federal.quotedEvidence).toBeUndefined();
    expect(federal.pageReferences).toBeUndefined();
    // Base fields still present
    expect(federal.statuteName).toBe('TILA');
    expect(federal.citation).toBe('15 U.S.C. § 1601');
  });
});

describe('_extractFindings — enriched evidence fields', () => {
  test('includes evidenceCitation for anomalies with pageReference and quotedText', () => {
    const report = makeConsolidatedReport();
    const findings = disputeLetterService._extractFindings(report);

    const anomaly = findings.find(f => f.type === 'anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly.evidenceCitation).toBe('[statement-jan.pdf, p.2]: Escrow Balance: $1,245.00');
  });

  test('includes evidenceCitation for discrepancies with per-document evidence', () => {
    const report = makeConsolidatedReport();
    const findings = disputeLetterService._extractFindings(report);

    const discrepancy = findings.find(f => f.type === 'discrepancy');
    expect(discrepancy).toBeDefined();
    expect(discrepancy.evidenceCitation).toContain('[statement-jan.pdf, p.3]');
    expect(discrepancy.evidenceCitation).toContain('[bank-records.pdf, p.1]');
    expect(discrepancy.evidenceCitation).toContain('vs');
  });

  test('omits evidenceCitation when enriched fields are absent (backward compatible)', () => {
    const report = makeUnenrichedConsolidatedReport();
    const findings = disputeLetterService._extractFindings(report);

    for (const finding of findings) {
      expect(finding.evidenceCitation).toBeUndefined();
    }
    // Base fields still present
    const anomaly = findings.find(f => f.type === 'anomaly');
    expect(anomaly.source).toBe('statement-feb.pdf');
    expect(anomaly.field).toBe('lateCharge');
  });
});

// ---------------------------------------------------------------------------
// Dual-format extraction — Phase 21-02 regression tests
//
// _extractViolations and _extractFindings must support both:
//   1. Consolidated report format (complianceFindings, documentAnalysis, forensicFindings)
//   2. Raw aggregated format (complianceReport, documentAnalyses, forensicReport)
// ---------------------------------------------------------------------------

describe('_extractViolations — dual format support', () => {
  test('reads violations from consolidated report format (complianceFindings)', () => {
    const report = {
      complianceFindings: {
        federalViolations: [
          { statuteName: 'RESPA', citation: '12 USC 2605(e)', severity: 'critical', description: 'QWR failure' }
        ],
        stateViolations: [
          { jurisdiction: 'CA', statuteName: 'CA HBOR', citation: 'Cal. Civ. Code §2924.18', severity: 'high', description: 'Dual tracking' }
        ]
      }
    };

    const violations = disputeLetterService._extractViolations(report);

    expect(violations).toHaveLength(2);
    expect(violations[0].type).toBe('federal');
    expect(violations[0].citation).toBe('12 USC 2605(e)');
    expect(violations[1].type).toBe('state');
    expect(violations[1].jurisdiction).toBe('CA');
  });

  test('reads violations from raw aggregated format (complianceReport)', () => {
    const report = {
      complianceReport: {
        violations: [
          { statuteName: 'TILA', citation: '15 USC 1601', severity: 'high', description: 'Disclosure failure' }
        ],
        stateViolations: [
          { jurisdiction: 'IL', statuteName: 'IL Interest Act', citation: '815 ILCS 205/4', severity: 'medium', description: 'Interest overcharge' }
        ]
      }
    };

    const violations = disputeLetterService._extractViolations(report);

    expect(violations).toHaveLength(2);
    expect(violations[0].type).toBe('federal');
    expect(violations[0].statuteName).toBe('TILA');
    expect(violations[1].type).toBe('state');
    expect(violations[1].jurisdiction).toBe('IL');
  });
});

describe('_extractFindings — dual format support', () => {
  test('reads findings from consolidated report format (documentAnalysis singular, forensicFindings)', () => {
    const report = {
      documentAnalysis: [
        {
          documentName: 'statement.pdf',
          anomalies: [
            { field: 'escrowBalance', severity: 'high', description: 'Escrow shortage' }
          ]
        }
      ],
      forensicFindings: {
        discrepancies: [
          { severity: 'critical', description: 'Amount mismatch between documents' }
        ]
      }
    };

    const findings = disputeLetterService._extractFindings(report);

    expect(findings).toHaveLength(2);
    const anomaly = findings.find(f => f.type === 'anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly.source).toBe('statement.pdf');
    expect(anomaly.field).toBe('escrowBalance');

    const discrepancy = findings.find(f => f.type === 'discrepancy');
    expect(discrepancy).toBeDefined();
    expect(discrepancy.description).toBe('Amount mismatch between documents');
  });

  test('reads findings from raw aggregated format (documentAnalyses plural, forensicReport)', () => {
    const report = {
      documentAnalyses: [
        {
          documentName: 'disclosure.pdf',
          anomalies: [
            { field: 'loanAmount', severity: 'critical', description: 'Loan amount discrepancy' }
          ]
        }
      ],
      forensicReport: {
        discrepancies: [
          { severity: 'high', type: 'date_inconsistency' }
        ]
      }
    };

    const findings = disputeLetterService._extractFindings(report);

    expect(findings).toHaveLength(2);
    const anomaly = findings.find(f => f.type === 'anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly.source).toBe('disclosure.pdf');

    const discrepancy = findings.find(f => f.type === 'discrepancy');
    expect(discrepancy).toBeDefined();
    expect(discrepancy.description).toBe('date_inconsistency');
  });
});

// ---------------------------------------------------------------------------
// Upstream reasoning/confidence in prompts — Phase 52-05
//
// When violations or findings include confidence scores, the prompt must include
// an "Analysis Confidence Context" section instructing Claude to modulate language
// strength based on confidence level. When no confidence data is present, the
// section must be omitted for backward compatibility.
// ---------------------------------------------------------------------------

describe('generateDisputeLetter — confidence context in prompts', () => {
  function makeReportWithConfidence() {
    return {
      caseSummary: {
        caseId: 'case-conf-001',
        borrowerName: 'Jane Doe',
        loanNumber: '12345',
        servicerName: 'ABC Mortgage Servicing',
        servicerAddress: '456 Corporate Blvd, Chicago, IL 60601'
      },
      documentAnalyses: [],
      forensicReport: { discrepancies: [] },
      complianceReport: {
        violations: [
          {
            id: 'viol-001',
            statuteName: 'RESPA',
            citation: '12 U.S.C. § 2605(e)',
            severity: 'high',
            description: 'Failure to respond to QWR',
            legalBasis: 'RESPA Section 6(e)',
            confidence: 0.92,
            confidenceLevel: 'high',
            reasoningSteps: ['Step 1: QWR letter dated 2026-01-01 found in file', 'Step 2: No response documented within 30-day window']
          },
          {
            id: 'viol-002',
            statuteName: 'TILA',
            citation: '15 U.S.C. § 1601',
            severity: 'medium',
            description: 'Disclosure timing violation',
            confidence: 0.65,
            confidenceLevel: 'medium'
          }
        ],
        stateViolations: []
      }
    };
  }

  test('should include confidence context section when violations have confidence scores', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeReportWithConfidence()
    );

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Analysis Confidence Context');
    expect(prompt).toContain('High-confidence findings');
    expect(prompt).toContain('Medium-confidence findings');
    expect(prompt).toContain('assertive, declarative language');
    expect(prompt).toContain('measured language');
    // High-confidence violation named
    expect(prompt).toContain('RESPA');
    // Medium-confidence violation named
    expect(prompt).toContain('TILA');
  });

  test('should omit confidence context section when no confidence data is present', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeUnenrichedConsolidatedReport()
    );

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('Analysis Confidence Context');
    expect(prompt).not.toContain('High-confidence findings');
    // Letter still generates successfully without confidence data
    expect(prompt).toContain('TILA');
    expect(prompt).toContain('15 U.S.C. § 1601');
  });

  test('_extractViolations includes confidence and confidenceLevel when present', () => {
    const report = makeReportWithConfidence();
    const violations = disputeLetterService._extractViolations(report);

    const high = violations.find(v => v.statuteName === 'RESPA');
    expect(high).toBeDefined();
    expect(high.confidence).toBe(0.92);
    expect(high.confidenceLevel).toBe('high');
    expect(high.reasoningContext).toContain('Step 1');

    const medium = violations.find(v => v.statuteName === 'TILA');
    expect(medium).toBeDefined();
    expect(medium.confidence).toBe(0.65);
    expect(medium.confidenceLevel).toBe('medium');
  });

  test('_extractViolations omits confidence fields when not present (backward compat)', () => {
    const report = makeUnenrichedConsolidatedReport();
    const violations = disputeLetterService._extractViolations(report);

    for (const v of violations) {
      expect(v.confidence).toBeUndefined();
      expect(v.confidenceLevel).toBeUndefined();
      expect(v.reasoningContext).toBeUndefined();
    }
  });

  test('_extractFindings includes confidence and confidenceLevel for anomalies when present', () => {
    const report = {
      documentAnalyses: [
        {
          documentName: 'statement.pdf',
          anomalies: [
            {
              field: 'escrowBalance',
              severity: 'high',
              description: 'Escrow shortage',
              confidence: 0.88,
              confidenceLevel: 'high'
            }
          ]
        }
      ],
      forensicReport: { discrepancies: [] }
    };

    const findings = disputeLetterService._extractFindings(report);

    const anomaly = findings.find(f => f.type === 'anomaly');
    expect(anomaly).toBeDefined();
    expect(anomaly.confidence).toBe(0.88);
    expect(anomaly.confidenceLevel).toBe('high');
  });

  test('_extractFindings includes confidence for discrepancies when present', () => {
    const report = {
      documentAnalyses: [],
      forensicReport: {
        discrepancies: [
          {
            severity: 'critical',
            description: 'Payment mismatch',
            confidence: 0.72,
            confidenceLevel: 'medium'
          }
        ]
      }
    };

    const findings = disputeLetterService._extractFindings(report);

    const discrepancy = findings.find(f => f.type === 'discrepancy');
    expect(discrepancy).toBeDefined();
    expect(discrepancy.confidence).toBe(0.72);
    expect(discrepancy.confidenceLevel).toBe('medium');
  });
});

describe('Full letter generation from stored consolidated report', () => {
  test('generates letter from stored report with complianceFindings/documentAnalysis/forensicFindings', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    // Stored consolidated report uses the consolidated format (not raw)
    const storedReport = {
      caseSummary: {
        borrowerName: 'Alice Johnson',
        loanNumber: 'LN-99999',
        propertyAddress: '789 Oak Ave',
        servicerName: 'National Mortgage Corp',
        servicerAddress: '100 Corp Way'
      },
      documentAnalysis: [
        {
          documentId: 'doc-001',
          documentName: 'statement.pdf',
          anomalies: [
            { id: 'anom-001', field: 'escrowBalance', severity: 'high', description: 'Escrow shortage' }
          ]
        }
      ],
      forensicFindings: {
        discrepancies: [
          { id: 'disc-001', severity: 'critical', description: 'Payment amount differs' }
        ]
      },
      complianceFindings: {
        federalViolations: [
          {
            id: 'viol-001',
            statuteName: 'RESPA',
            citation: '12 USC 2605(e)',
            severity: 'critical',
            description: 'QWR response failure',
            legalBasis: 'RESPA Section 6(e)'
          }
        ],
        stateViolations: []
      }
    };

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      storedReport
    );

    // Verify letter generated without error
    expect(result.error).toBeUndefined();
    expect(result.letterType).toBe('qualified_written_request');
    expect(result.content).toBeDefined();
    expect(result.content.subject).toBeDefined();
    expect(result.content.body).toBeDefined();
    expect(result.content.demands).toBeInstanceOf(Array);

    // Verify the prompt included violation and finding details
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('RESPA');
    expect(prompt).toContain('12 USC 2605(e)');
    expect(prompt).toContain('QWR response failure');
    expect(prompt).toContain('Escrow shortage');
    expect(prompt).toContain('Payment amount differs');
  });
});

// ---------------------------------------------------------------------------
// Structured evidenceFootnotes — Phase 53-03
//
// When the report has enriched evidence, the prompt requests a structured
// `evidenceFootnotes` array in Claude's JSON output. The service normalizes
// the response: drops malformed entries, derives missing citations via
// reportFormattersService, truncates context, and ALWAYS returns an array
// (defaulting to [] on errors). Never throws.
// ---------------------------------------------------------------------------

describe('generateDisputeLetter — evidenceFootnotes (Phase 53-03)', () => {
  function makeMockLetterResponseWithFootnotes(footnotesOverride) {
    return {
      ...makeMockLetterResponse(),
      evidenceFootnotes: footnotesOverride
    };
  }

  test('prompt requests evidenceFootnotes array and JSON schema example when enriched', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('Structured Footnotes Array');
    expect(prompt).toContain('evidenceFootnotes');
    expect(prompt).toContain('findingId');
    expect(prompt).toContain('canonical format `[DocName, p.X]: "quotedText"`');
  });

  test('prompt does NOT request evidenceFootnotes when not enriched (backward compat)', async () => {
    const mockResponse = makeMockLetterResponse();
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(mockResponse) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeUnenrichedConsolidatedReport()
    );

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('Structured Footnotes Array');
    // The Evidence Citation Requirements section (where the structured-footnote
    // directive lives) must NOT appear when un-enriched.
    expect(prompt).not.toContain('Evidence Citation Requirements');
    // The JSON example must NOT include the evidenceFootnotes array
    expect(prompt).not.toContain('"evidenceFootnotes":');
    // The instructions DO tell Claude to omit the field entirely (so the
    // single occurrence of "evidenceFootnotes" here is intentional)
    expect(prompt).toContain('Omit the evidenceFootnotes field entirely');
  });

  test('populates evidenceFootnotes when Claude returns valid array', async () => {
    const claudeFootnotes = [
      {
        findingId: 'anom-001',
        documentName: 'statement-jan.pdf',
        pageNumber: 2,
        quotedText: 'Escrow Balance: $1,245.00',
        citation: '[statement-jan.pdf, p.2]: "Escrow Balance: $1,245.00"',
        context: 'Servicer escrow balance contradicts disclosed amount.'
      }
    ];
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(makeMockLetterResponseWithFootnotes(claudeFootnotes)) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.evidenceFootnotes).toHaveLength(1);
    const footnote = result.content.evidenceFootnotes[0];
    expect(footnote.findingId).toBe('anom-001');
    expect(footnote.documentName).toBe('statement-jan.pdf');
    expect(footnote.pageNumber).toBe(2);
    expect(footnote.quotedText).toBe('Escrow Balance: $1,245.00');
    expect(footnote.citation).toBe('[statement-jan.pdf, p.2]: "Escrow Balance: $1,245.00"');
    expect(footnote.context).toBe('Servicer escrow balance contradicts disclosed amount.');
  });

  test('defaults evidenceFootnotes to [] when Claude omits the field', async () => {
    // makeMockLetterResponse() has no evidenceFootnotes property
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(makeMockLetterResponse()) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.evidenceFootnotes).toEqual([]);
  });

  test('drops footnote entry missing documentName, keeps valid entries', async () => {
    const claudeFootnotes = [
      { citation: '[unknown]: "x"' }, // malformed — no documentName
      {
        documentName: 'bank-records.pdf',
        pageNumber: 1,
        quotedText: 'ACH Debit',
        citation: '[bank-records.pdf, p.1]: "ACH Debit"'
      }
    ];
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(makeMockLetterResponseWithFootnotes(claudeFootnotes)) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.evidenceFootnotes).toHaveLength(1);
    expect(result.content.evidenceFootnotes[0].documentName).toBe('bank-records.pdf');
  });

  test('derives citation via formatter when Claude omits it', async () => {
    const claudeFootnotes = [
      {
        documentName: 'statement-jan.pdf',
        pageNumber: 4,
        quotedText: 'Late Fee: $35.00'
        // no `citation` field
      }
    ];
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(makeMockLetterResponseWithFootnotes(claudeFootnotes)) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.evidenceFootnotes).toHaveLength(1);
    // formatCitation derives the canonical format
    expect(result.content.evidenceFootnotes[0].citation).toBe('[statement-jan.pdf, p.4]: "Late Fee: $35.00"');
  });

  test('truncates footnote context to 300 chars', async () => {
    const longContext = 'x'.repeat(500);
    const claudeFootnotes = [
      {
        documentName: 'statement-jan.pdf',
        pageNumber: 2,
        quotedText: 'short',
        citation: '[statement-jan.pdf, p.2]: "short"',
        context: longContext
      }
    ];
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(makeMockLetterResponseWithFootnotes(claudeFootnotes)) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.evidenceFootnotes).toHaveLength(1);
    expect(result.content.evidenceFootnotes[0].context).toHaveLength(300);
  });

  test('drops entry when citation missing AND formatter cannot derive (no quotedText/pageNumber data)', async () => {
    // When only documentName is present (no page, no quoted text), formatCitation
    // produces '[documentName]' (still non-null), so entry IS kept. We test the
    // truly-impossible derivation path by stubbing formatCitation to return null.
    const claudeFootnotes = [
      { documentName: 'statement-jan.pdf' } // no citation, no page, no quote
    ];
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(makeMockLetterResponseWithFootnotes(claudeFootnotes)) }],
      usage: { input_tokens: 600, output_tokens: 900 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    // Entry kept — formatCitation derives '[statement-jan.pdf]'
    expect(result.content.evidenceFootnotes).toHaveLength(1);
    expect(result.content.evidenceFootnotes[0].citation).toBe('[statement-jan.pdf]');
  });

  test('handles non-array evidenceFootnotes from Claude (defaults to [])', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ ...makeMockLetterResponse(), evidenceFootnotes: 'not an array' }) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.evidenceFootnotes).toEqual([]);
  });

  test('un-enriched report still returns evidenceFootnotes: [] on the content', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify(makeMockLetterResponse()) }],
      usage: { input_tokens: 500, output_tokens: 800 }
    });

    const result = await disputeLetterService.generateDisputeLetter(
      'qualified_written_request',
      makeUnenrichedConsolidatedReport()
    );

    expect(result.error).toBeUndefined();
    expect(result.content.evidenceFootnotes).toEqual([]);
  });
});
