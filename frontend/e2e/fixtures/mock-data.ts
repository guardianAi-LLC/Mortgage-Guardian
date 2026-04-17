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
// Auth helper
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL || 'n.garrison@me.com'

/** Sign in via Clerk testing token + server-side sign-in token. */
export async function signIn(page: Page, context: BrowserContext) {
  await setupClerkTestingToken({ page, context })
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL, setupClerkTestingTokenOptions: { context } })
}
