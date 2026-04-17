import { test, expect } from '@playwright/test'
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright'

// ---------------------------------------------------------------------------
// Mock data (will be extracted to fixtures/mock-data.ts in Task 3)
// ---------------------------------------------------------------------------

const MOCK_CASE = {
  id: 'case-001',
  case_name: 'Smith Mortgage Review',
  borrower_name: 'Jane Smith',
  property_address: '123 Main St, Springfield, IL 62701',
  loan_number: 'LOAN-12345678',
  servicer_name: 'ABC Mortgage Co.',
  status: 'open',
  notes: 'Initial review of escrow discrepancies',
  documents: [
    {
      document_id: 'doc-001',
      file_name: 'mortgage_statement_jan.pdf',
      document_type: 'mortgage_statement',
      pipeline_status: 'complete',
      created_at: '2026-04-01T12:00:00Z',
      analysis_report: {
        anomalies: [
          { id: 'a1', field: 'escrow', type: 'miscalculation', severity: 'high', description: 'Escrow amount mismatch' },
        ],
        summary: { riskLevel: 'high', keyFindings: ['Escrow miscalculation detected'] },
        completeness: { score: 0.85, totalExpected: 20, totalFound: 17 },
        documentInfo: { documentId: 'doc-001', fileName: 'mortgage_statement_jan.pdf', classificationType: 'mortgage_statement', classificationSubtype: 'monthly' },
      },
    },
  ],
  created_at: '2026-03-15T10:00:00Z',
  updated_at: '2026-04-10T08:00:00Z',
}

const MOCK_CASES_LIST = [
  MOCK_CASE,
  {
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
  },
  {
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
  },
]

// ---------------------------------------------------------------------------
// Route interception helpers
// ---------------------------------------------------------------------------

async function interceptCasesAPI(page: import('@playwright/test').Page) {
  // List cases
  await page.route('**/api/v1/cases?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cases: MOCK_CASES_LIST, total: MOCK_CASES_LIST.length }),
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
    // GET without query string (fallback)
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cases: MOCK_CASES_LIST, total: MOCK_CASES_LIST.length }),
    })
  })

  // Single case detail
  await page.route('**/api/v1/cases/case-001', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CASE),
    })
  )

  // Forensic analysis
  await page.route('**/api/v1/cases/*/forensic-analysis', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        discrepancies: [],
        timelineViolations: [],
        paymentVerification: null,
      }),
    })
  )

  // Compliance
  await page.route('**/api/v1/cases/*/compliance', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        federalViolations: [],
        stateViolations: [],
        jurisdiction: null,
      }),
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

// ---------------------------------------------------------------------------
// Auth helper: sign in via Clerk testing token + server-side sign-in token
// ---------------------------------------------------------------------------

const TEST_USER_EMAIL = process.env.E2E_CLERK_USER_EMAIL || 'n.garrison@me.com'

async function signIn(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  await setupClerkTestingToken({ page, context })
  await page.goto('/')
  await clerk.signIn({ page, emailAddress: TEST_USER_EMAIL, setupClerkTestingTokenOptions: { context } })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Case CRUD flows', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await interceptCasesAPI(page)
    await signIn(page, context)
  })

  test.describe('Case list', () => {
    test('cases page loads with case table', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // The dashboard renders a CaseTable; verify at least one case name appears
      await expect(page.getByText('Smith Mortgage Review')).toBeVisible()
      await expect(page.getByText('Johnson Property Audit')).toBeVisible()
    })

    test('case filters render and respond', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Search input
      const searchInput = page.getByPlaceholder('Search cases...')
      await expect(searchInput).toBeVisible()

      // Status dropdown trigger
      const selectTriggers = page.locator('button[role="combobox"]')
      await expect(selectTriggers.first()).toBeVisible()

      // Type in search and verify filtering happens client-side
      await searchInput.fill('Smith')
      // Wait for debounce
      await page.waitForTimeout(400)
      await expect(page.getByText('Smith Mortgage Review')).toBeVisible()
    })

    test('new case button navigates to form', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Click the "New Case" button
      const newCaseButton = page.getByRole('link', { name: /new case/i })
      await expect(newCaseButton).toBeVisible()
      await newCaseButton.click()
      await expect(page).toHaveURL(/\/dashboard\/cases\/new/)
    })
  })

  test.describe('Case creation', () => {
    test('case form renders with required fields', async ({ page }) => {
      await page.goto('/dashboard/cases/new')
      await page.waitForLoadState('networkidle')

      // Verify key form fields
      await expect(page.getByLabel(/case name/i)).toBeVisible()
      await expect(page.getByLabel(/borrower name/i)).toBeVisible()
      await expect(page.getByLabel(/property address/i)).toBeVisible()
      await expect(page.getByLabel(/loan number/i)).toBeVisible()
      await expect(page.getByLabel(/servicer name/i)).toBeVisible()
      await expect(page.getByLabel(/notes/i)).toBeVisible()
    })

    test('case form validates required fields', async ({ page }) => {
      await page.goto('/dashboard/cases/new')
      await page.waitForLoadState('networkidle')

      // The Create Case button should be disabled when case name is empty
      const submitButton = page.getByRole('button', { name: /create case/i })
      await expect(submitButton).toBeDisabled()

      // Type a case name to enable the button, then clear it
      const caseNameInput = page.getByLabel(/case name/i)
      await caseNameInput.fill('Test')
      await expect(submitButton).toBeEnabled()
      await caseNameInput.clear()
      await expect(submitButton).toBeDisabled()
    })

    test('case form submits successfully', async ({ page }) => {
      // Also intercept the specific new case redirect
      await page.route('**/api/v1/cases/case-new-001', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'case-new-001',
            case_name: 'Test Case',
            borrower_name: 'John Doe',
            status: 'open',
            documents: [],
            created_at: new Date().toISOString(),
          }),
        })
      )

      await page.goto('/dashboard/cases/new')
      await page.waitForLoadState('networkidle')

      // Fill in the form
      await page.getByLabel(/case name/i).fill('Test Case')
      await page.getByLabel(/borrower name/i).fill('John Doe')
      await page.getByLabel(/property address/i).fill('100 Test St')
      await page.getByLabel(/loan number/i).fill('LOAN-TEST-001')
      await page.getByLabel(/servicer name/i).fill('Test Servicer')

      // Submit
      await page.getByRole('button', { name: /create case/i }).click()

      // Should redirect to the new case detail page
      await page.waitForURL('**/dashboard/cases/case-new-001')
    })
  })

  test.describe('Case detail', () => {
    test('case detail page shows case info', async ({ page }) => {
      await page.goto('/dashboard/cases/case-001')
      await page.waitForLoadState('networkidle')

      // Verify heading shows case name
      await expect(page.getByRole('heading', { name: 'Smith Mortgage Review' })).toBeVisible()

      // Verify info card fields
      await expect(page.getByText('Case Information')).toBeVisible()
      await expect(page.getByText('Jane Smith')).toBeVisible()
      await expect(page.getByText('123 Main St, Springfield, IL 62701')).toBeVisible()
      await expect(page.getByText('LOAN-12345678')).toBeVisible()
      await expect(page.getByText('ABC Mortgage Co.')).toBeVisible()
    })

    test('case analysis page loads', async ({ page }) => {
      await page.goto('/dashboard/cases/case-001/analysis')
      await page.waitForLoadState('networkidle')

      // Verify analysis heading
      await expect(page.getByRole('heading', { name: /analysis/i })).toBeVisible()

      // Verify tabs are present
      await expect(page.getByRole('tab', { name: /forensic/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /compliance/i })).toBeVisible()
    })

    test('case report page loads', async ({ page }) => {
      await page.goto('/dashboard/cases/case-001/report')
      await page.waitForLoadState('networkidle')

      // Verify report heading
      await expect(page.getByRole('heading', { name: /consolidated report/i })).toBeVisible()

      // No report exists yet, so should show empty state with generate button
      await expect(page.getByText(/no report generated/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /generate report/i })).toBeVisible()
    })
  })
})
