/**
 * documentPipelineService._runAudit — unit tests (M001/S04/T02).
 *
 * Verifies the AUDITING terminus:
 *   - happy path: token -> getTransactions -> cross-reference -> rule engine
 *     -> findings with plaidEvidence
 *   - no-token path: rule engine still runs; matchedTxCount = 0
 *   - getTransactions failure: pipeline does not crash; auditReport carries
 *     empty matchedTransactions but findings can still be present
 */

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => null)
}));

// Avoid pulling Anthropic / pdf-parse — we exercise _runAudit directly with a
// pre-populated pipeline object.
jest.mock('@anthropic-ai/sdk', () => {
  const Mock = jest.fn().mockImplementation(() => ({
    messages: { create: jest.fn() }
  }));
  return Mock;
});

const path = require('path');
const fs = require('fs');

// Mock plaidService so we can drive getTransactions deterministically.
jest.mock('../../services/plaidService', () => ({
  getTransactions: jest.fn()
}));

// Mock plaidDataService.getAccessTokenForUser. Other methods stay real.
jest.mock('../../services/plaidDataService', () => {
  const actual = jest.requireActual('../../services/plaidDataService');
  actual.getAccessTokenForUser = jest.fn();
  return actual;
});

const plaidService = require('../../services/plaidService');
const plaidDataService = require('../../services/plaidDataService');
const documentPipeline = require('../../services/documentPipelineService');
const { PIPELINE_STATES } = require('../../services/documentPipelineService');

const fixtureDir = path.join(__dirname, '..', 'fixtures', 'm001-s04');
const plaidTransactions = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, 'plaid-transactions.json'), 'utf8')
);
const expectedAnomalies = JSON.parse(
  fs.readFileSync(path.join(fixtureDir, 'expected-anomalies.json'), 'utf8')
);

function buildPipeline() {
  return {
    documentId: 'doc-s04-test',
    userId: 'user-s04-test',
    caseId: 'case-s04-test',
    status: PIPELINE_STATES.ANALYZED,
    steps: { analyzed: { completedAt: new Date().toISOString() } },
    classificationResults: {
      classificationType: 'mortgage_statement',
      classificationSubtype: 'periodic_statement'
    },
    analysisResults: {
      documentId: 'doc-s04-test',
      documentType: 'mortgage_statement',
      documentSubtype: 'periodic_statement',
      anomalies: expectedAnomalies,
      extractedData: {
        amounts: { monthlyPayment: 1420.00 },
        dates: { paymentDueDate: '2026-03-01' },
        payments: [
          { date: '2026-01-02', amount: 1420.00 },
          { date: '2026-02-01', amount: 1420.00 },
          { date: '2026-03-01', amount: 1420.00 }
        ]
      }
    }
  };
}

beforeEach(() => {
  plaidService.getTransactions.mockReset();
  plaidDataService.getAccessTokenForUser.mockReset();
});

describe('documentPipelineService._runAudit', () => {
  test('happy path: produces findings with Plaid evidence', async () => {
    plaidDataService.getAccessTokenForUser.mockResolvedValue('access-sandbox-test');
    plaidService.getTransactions.mockResolvedValue({
      transactions: plaidTransactions,
      totalTransactions: plaidTransactions.length,
      accounts: []
    });

    const pipeline = buildPipeline();
    await documentPipeline._runAudit(pipeline);

    expect(pipeline.status).toBe(PIPELINE_STATES.AUDITING);
    expect(pipeline.auditReport).toBeDefined();
    expect(pipeline.auditReport.findings.length).toBeGreaterThanOrEqual(1);
    expect(pipeline.auditReport.summary.findingsCount).toBe(
      pipeline.auditReport.findings.length
    );
    expect(pipeline.auditReport.summary.matchedTxCount).toBeGreaterThanOrEqual(1);
    expect(pipeline.auditReport._metadata.skipAiAnalysis).toBe(true);
    expect(typeof pipeline.auditReport._metadata.durationMs).toBe('number');

    // Every finding must carry plaidEvidence with the matched txns.
    for (const f of pipeline.auditReport.findings) {
      expect(f.plaidEvidence).toBeDefined();
      expect(Array.isArray(f.plaidEvidence.matchedTransactions)).toBe(true);
      expect(f.plaidEvidence.matchedTransactions.length).toBeGreaterThanOrEqual(1);
    }

    expect(plaidService.getTransactions).toHaveBeenCalledTimes(1);
  });

  test('no Plaid token: rule engine still runs with empty paymentVerification', async () => {
    plaidDataService.getAccessTokenForUser.mockResolvedValue(null);

    const pipeline = buildPipeline();
    await documentPipeline._runAudit(pipeline);

    expect(plaidService.getTransactions).not.toHaveBeenCalled();
    expect(pipeline.auditReport.summary.matchedTxCount).toBe(0);
    // Anomaly-driven violations should still surface from the rule engine.
    expect(pipeline.auditReport.findings.length).toBeGreaterThanOrEqual(1);
  });

  test('Plaid getTransactions failure: surfaces empty matchedTransactions, does not throw', async () => {
    plaidDataService.getAccessTokenForUser.mockResolvedValue('access-sandbox-test');
    plaidService.getTransactions.mockRejectedValue(new Error('upstream 5xx'));

    const pipeline = buildPipeline();
    await expect(documentPipeline._runAudit(pipeline)).resolves.toBeUndefined();
    expect(pipeline.auditReport).toBeDefined();
    expect(pipeline.auditReport.summary.matchedTxCount).toBe(0);
  });
});
