import type { Page, BrowserContext } from '@playwright/test'
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright'

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

interface MockCaseOverrides {
  id?: string
  case_name?: string
  borrower_name?: string
  property_address?: string
  loan_number?: string
  servicer_name?: string
  status?: string
  notes?: string | null
  documents?: MockDocument[]
  created_at?: string
  updated_at?: string
}

interface MockDocumentOverrides {
  document_id?: string
  file_name?: string
  document_type?: string
  pipeline_status?: string
  created_at?: string
  analysis_report?: MockAnalysisReport | null
}

interface MockAnomaly {
  id: string
  field: string
  type: string
  severity: string
  description: string
}

interface MockAnalysisReport {
  anomalies: MockAnomaly[]
  summary: { riskLevel: string; keyFindings: string[] }
  completeness: { score: number; totalExpected: number; totalFound: number }
  documentInfo: { documentId: string; fileName: string; classificationType: string; classificationSubtype: string }
}

interface MockDocument {
  document_id: string
  file_name: string
  document_type: string
  pipeline_status: string
  created_at: string
  analysis_report: MockAnalysisReport | null
}

/** Create a single mock case with optional overrides. */
export function mockCase(overrides: MockCaseOverrides = {}) {
  return {
    id: 'case-001',
    case_name: 'Smith Mortgage Review',
    borrower_name: 'Jane Smith',
    property_address: '123 Main St, Springfield, IL 62701',
    loan_number: 'LOAN-12345678',
    servicer_name: 'ABC Mortgage Co.',
    status: 'open',
    notes: 'Initial review of escrow discrepancies',
    documents: [mockDocument()],
    created_at: '2026-03-15T10:00:00Z',
    updated_at: '2026-04-10T08:00:00Z',
    ...overrides,
  }
}

/** Create a single mock document with optional overrides. */
export function mockDocument(overrides: MockDocumentOverrides = {}): MockDocument {
  return {
    document_id: 'doc-001',
    file_name: 'mortgage_statement_jan.pdf',
    document_type: 'mortgage_statement',
    pipeline_status: 'complete',
    created_at: '2026-04-01T12:00:00Z',
    analysis_report: {
      anomalies: [
        { id: 'a1', field: 'escrow', type: 'miscalculation', severity: 'high', description: 'Escrow amount mismatch' },
        { id: 'a2', field: 'interest_rate', type: 'discrepancy', severity: 'critical', description: 'Interest rate does not match contract' },
      ],
      summary: { riskLevel: 'high', keyFindings: ['Escrow miscalculation detected', 'Interest rate discrepancy'] },
      completeness: { score: 0.85, totalExpected: 20, totalFound: 17 },
      documentInfo: { documentId: 'doc-001', fileName: 'mortgage_statement_jan.pdf', classificationType: 'mortgage_statement', classificationSubtype: 'monthly' },
    },
    ...overrides,
  }
}

/** Create a mock analysis result with optional overrides. */
export function mockAnalysis(overrides: Partial<MockAnalysisReport> = {}): MockAnalysisReport {
  const doc = mockDocument()
  return {
    ...doc.analysis_report!,
    ...overrides,
  }
}

/** Create a list of mock cases for list views. */
export function mockCasesList(count = 3) {
  const templates = [
    mockCase(),
    mockCase({
      id: 'case-002',
      case_name: 'Johnson Property Audit',
      borrower_name: 'Bob Johnson',
      property_address: '456 Oak Ave, Chicago, IL 60601',
      loan_number: 'LOAN-87654321',
      servicer_name: 'XYZ Lending',
      status: 'in_review',
      notes: null,
      documents: [],
      created_at: '2026-03-20T14:00:00Z',
      updated_at: '2026-04-08T09:00:00Z',
    }),
    mockCase({
      id: 'case-003',
      case_name: 'Williams Refinance Case',
      borrower_name: 'Carol Williams',
      property_address: '789 Pine Rd, Naperville, IL 60540',
      loan_number: 'LOAN-11223344',
      servicer_name: 'ABC Mortgage Co.',
      status: 'complete',
      notes: 'Completed review',
      documents: [],
      created_at: '2026-02-01T09:00:00Z',
      updated_at: '2026-03-01T10:00:00Z',
    }),
  ]
  return templates.slice(0, count)
}

/** Create a list of mock documents with mixed statuses. */
export function mockDocumentsList(count = 4) {
  const templates: MockDocument[] = [
    mockDocument(),
    mockDocument({
      document_id: 'doc-002',
      file_name: 'bank_statement_feb.pdf',
      document_type: 'bank_statement',
      pipeline_status: 'analyzing',
      created_at: '2026-04-05T09:00:00Z',
      analysis_report: null,
    }),
    mockDocument({
      document_id: 'doc-003',
      file_name: 'tax_return_2025.pdf',
      document_type: 'tax_document',
      pipeline_status: 'failed',
      created_at: '2026-04-10T15:00:00Z',
      analysis_report: null,
    }),
    mockDocument({
      document_id: 'doc-004',
      file_name: 'servicer_letter.pdf',
      document_type: 'correspondence',
      pipeline_status: 'complete',
      created_at: '2026-03-28T11:00:00Z',
      analysis_report: {
        anomalies: [],
        summary: { riskLevel: 'clean', keyFindings: [] },
        completeness: { score: 1.0, totalExpected: 10, totalFound: 10 },
        documentInfo: { documentId: 'doc-004', fileName: 'servicer_letter.pdf', classificationType: 'correspondence', classificationSubtype: 'general' },
      },
    }),
  ]
  return templates.slice(0, count)
}

// ---------------------------------------------------------------------------
// Route interceptor helpers
// ---------------------------------------------------------------------------

/** Set up page.route interception for /api/v1/cases endpoints. */
export async function interceptCasesAPI(page: Page, data?: ReturnType<typeof mockCasesList>) {
  const cases = data ?? mockCasesList()
  const primaryCase = cases[0]

  // List cases
  await page.route('**/api/v1/cases?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cases, total: cases.length }),
    })
  )
  await page.route('**/api/v1/cases', (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'case-new-001', ...body, status: 'open', created_at: new Date().toISOString() }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cases, total: cases.length }),
    })
  })

  // Single case detail
  await page.route('**/api/v1/cases/case-001', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(primaryCase),
    })
  )

  // Forensic analysis
  await page.route('**/api/v1/cases/*/forensic-analysis', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ discrepancies: [], timelineViolations: [], paymentVerification: null }),
    })
  )

  // Compliance
  await page.route('**/api/v1/cases/*/compliance', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ federalViolations: [], stateViolations: [], jurisdiction: null }),
    })
  )

  // Report
  await page.route('**/api/v1/cases/*/report', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"Not found"}' })
  })
}

/** Set up page.route interception for /api/v1/documents endpoints. */
export async function interceptDocumentsAPI(page: Page, data?: ReturnType<typeof mockDocumentsList>) {
  const documents = data ?? mockDocumentsList()
  const primaryDoc = documents[0]
  const primaryAnalysis = primaryDoc.analysis_report

  // List documents
  await page.route('**/api/v1/documents?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documents, total: documents.length }),
    })
  )
  await page.route('**/api/v1/documents', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents, total: documents.length }),
      })
    }
    return route.continue()
  })

  // Document status (must be registered before the catch-all)
  await page.route('**/api/v1/documents/doc-001/status', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        documentId: 'doc-001',
        status: 'complete',
        steps: { ocr: { status: 'complete' }, classifying: { status: 'complete' }, analyzing: { status: 'complete' } },
      }),
    })
  )

  // Document analysis
  await page.route('**/api/v1/documents/doc-001/analysis', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(primaryAnalysis),
    })
  )

  // Retry document
  await page.route('**/api/v1/documents/*/retry', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  )

  // Single document (catch-all for GET and DELETE)
  await page.route('**/api/v1/documents/*', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(primaryDoc),
    })
  })
}

// ---------------------------------------------------------------------------
// Analytics mock data
// ---------------------------------------------------------------------------

/** Create mock analytics data for the analytics dashboard. */
export function mockAnalyticsData() {
  return {
    cases: [
      mockCase({
        documents: [
          mockDocument({
            analysis_report: {
              anomalies: [
                { id: 'a1', field: 'escrow', type: 'miscalculation', severity: 'high', description: 'Escrow amount mismatch' },
                { id: 'a2', field: 'interest_rate', type: 'discrepancy', severity: 'critical', description: 'Interest rate discrepancy' },
              ],
              summary: { riskLevel: 'high', keyFindings: ['Escrow miscalculation', 'Interest rate discrepancy'] },
              completeness: { score: 85, totalExpected: 20, totalFound: 17 },
              documentInfo: { documentId: 'doc-001', fileName: 'mortgage_statement_jan.pdf', classificationType: 'mortgage_statement', classificationSubtype: 'monthly' },
            },
          }),
          mockDocument({
            document_id: 'doc-002',
            file_name: 'bank_statement_feb.pdf',
            document_type: 'bank_statement',
            pipeline_status: 'complete',
            analysis_report: {
              anomalies: [
                { id: 'a3', field: 'payment', type: 'late_fee', severity: 'medium', description: 'Late fee incorrectly applied' },
              ],
              summary: { riskLevel: 'medium', keyFindings: ['Late fee issue'] },
              completeness: { score: 92, totalExpected: 15, totalFound: 14 },
              documentInfo: { documentId: 'doc-002', fileName: 'bank_statement_feb.pdf', classificationType: 'bank_statement', classificationSubtype: 'monthly' },
            },
          }),
        ],
      }),
      mockCase({
        id: 'case-002',
        case_name: 'Johnson Property Audit',
        borrower_name: 'Bob Johnson',
        status: 'in_review',
        documents: [
          mockDocument({
            document_id: 'doc-003',
            file_name: 'tax_return.pdf',
            document_type: 'tax_document',
            pipeline_status: 'complete',
            analysis_report: {
              anomalies: [
                { id: 'a4', field: 'income', type: 'miscalculation', severity: 'low', description: 'Minor income discrepancy' },
              ],
              summary: { riskLevel: 'low', keyFindings: ['Minor income discrepancy'] },
              completeness: { score: 95, totalExpected: 10, totalFound: 10 },
              documentInfo: { documentId: 'doc-003', fileName: 'tax_return.pdf', classificationType: 'tax_document', classificationSubtype: 'annual' },
            },
          }),
        ],
      }),
      mockCase({
        id: 'case-003',
        case_name: 'Williams Refinance Case',
        borrower_name: 'Carol Williams',
        status: 'complete',
        documents: [],
      }),
    ],
    total: 3,
  }
}

/** Create empty analytics data (no cases). */
export function mockEmptyAnalyticsData() {
  return { cases: [], total: 0 }
}

/** Set up page.route interception for analytics (cases list used by useAnalytics). */
export async function interceptAnalyticsAPI(page: Page, data?: ReturnType<typeof mockAnalyticsData>) {
  const responseData = data ?? mockAnalyticsData()

  await page.route('**/api/v1/cases?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    })
  )
  await page.route('**/api/v1/cases', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseData),
    })
  )
}

// ---------------------------------------------------------------------------
// Plaid / Bank account mock data
// ---------------------------------------------------------------------------

export interface MockPlaidAccount {
  account_id: string
  name: string
  official_name: string
  type: string
  subtype: string
  mask: string
  balances: {
    available: number | null
    current: number | null
    limit: number | null
    iso_currency_code: string
  }
}

export interface MockPlaidTransaction {
  transaction_id: string
  account_id: string
  name: string
  merchant_name: string | null
  amount: number
  date: string
  category: string[]
  pending: boolean
}

/** Create mock Plaid accounts. */
export function mockPlaidAccounts(): MockPlaidAccount[] {
  return [
    {
      account_id: 'acct-001',
      name: 'Checking',
      official_name: 'Gold Checking',
      type: 'depository',
      subtype: 'checking',
      mask: '4567',
      balances: { available: 5230.50, current: 5430.50, limit: null, iso_currency_code: 'USD' },
    },
    {
      account_id: 'acct-002',
      name: 'Savings',
      official_name: 'Premium Savings',
      type: 'depository',
      subtype: 'savings',
      mask: '8901',
      balances: { available: 22100.00, current: 22100.00, limit: null, iso_currency_code: 'USD' },
    },
  ]
}

/** Create mock Plaid transactions. */
export function mockTransactions(): MockPlaidTransaction[] {
  return [
    {
      transaction_id: 'tx-001',
      account_id: 'acct-001',
      name: 'ABC Mortgage Payment',
      merchant_name: 'ABC Mortgage Co',
      amount: 1850.00,
      date: '2026-04-01',
      category: ['Payment', 'Mortgage'],
      pending: false,
    },
    {
      transaction_id: 'tx-002',
      account_id: 'acct-001',
      name: 'Grocery Store',
      merchant_name: 'Fresh Mart',
      amount: 142.30,
      date: '2026-04-03',
      category: ['Shops', 'Groceries'],
      pending: false,
    },
    {
      transaction_id: 'tx-003',
      account_id: 'acct-001',
      name: 'Escrow Payment',
      merchant_name: null,
      amount: 450.00,
      date: '2026-04-05',
      category: ['Payment', 'Insurance'],
      pending: true,
    },
    {
      transaction_id: 'tx-004',
      account_id: 'acct-002',
      name: 'Interest Payment',
      merchant_name: null,
      amount: -12.50,
      date: '2026-04-02',
      category: ['Transfer', 'Interest'],
      pending: false,
    },
  ]
}

/** Set up page.route interception for Plaid API endpoints. */
export async function interceptPlaidAPI(
  page: Page,
  opts?: {
    accounts?: MockPlaidAccount[]
    transactions?: MockPlaidTransaction[]
    empty?: boolean
  }
) {
  const accounts = opts?.empty ? [] : (opts?.accounts ?? mockPlaidAccounts())
  const transactions = opts?.empty ? [] : (opts?.transactions ?? mockTransactions())

  // Link token creation
  await page.route('**/api/v1/plaid/link_token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ linkToken: 'link-sandbox-test-token' }),
    })
  )

  // Token exchange
  await page.route('**/api/v1/plaid/exchange_token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ access_token: 'access-sandbox-test-token' }),
    })
  )

  // Accounts
  await page.route('**/api/v1/plaid/accounts', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts }),
    })
  )

  // Transactions
  await page.route('**/api/v1/plaid/transactions', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transactions }),
    })
  )

  // Item info
  await page.route('**/api/v1/plaid/item', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        item: {
          institution_id: 'ins_001',
          institution_name: 'First National Bank',
          consent_expiration_time: null,
        },
      }),
    })
  })
}

// ---------------------------------------------------------------------------
// Settings mock data
// ---------------------------------------------------------------------------

/** Set up page.route interception for settings page (cases + documents for export). */
export async function interceptSettingsAPI(page: Page) {
  await page.route('**/api/v1/cases?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cases: mockCasesList(2), total: 2 }),
    })
  )
  await page.route('**/api/v1/cases', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cases: mockCasesList(2), total: 2 }),
    })
  )
  await page.route('**/api/v1/documents?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documents: mockDocumentsList(2), total: 2 }),
    })
  )
  await page.route('**/api/v1/documents', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documents: mockDocumentsList(2), total: 2 }),
    })
  )
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL || 'n.garrison@me.com'

/** Sign in via Clerk testing token + server-side sign-in token. */
export async function signIn(page: Page, context: BrowserContext) {
  await setupClerkTestingToken({ page, context })
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL })
}
