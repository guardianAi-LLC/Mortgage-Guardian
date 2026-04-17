import { test, expect } from '@playwright/test'
import { setupClerkTestingToken, clerk } from '@clerk/testing/playwright'

// ---------------------------------------------------------------------------
// Mock data (will be extracted to fixtures/mock-data.ts in Task 3)
// ---------------------------------------------------------------------------

const MOCK_DOCUMENTS = [
  {
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
  },
  {
    document_id: 'doc-002',
    file_name: 'bank_statement_feb.pdf',
    document_type: 'bank_statement',
    pipeline_status: 'analyzing',
    created_at: '2026-04-05T09:00:00Z',
    analysis_report: null,
  },
  {
    document_id: 'doc-003',
    file_name: 'tax_return_2025.pdf',
    document_type: 'tax_document',
    pipeline_status: 'failed',
    created_at: '2026-04-10T15:00:00Z',
    analysis_report: null,
  },
  {
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
  },
]

const MOCK_DOCUMENT_DETAIL = MOCK_DOCUMENTS[0]

const MOCK_ANALYSIS = {
  anomalies: MOCK_DOCUMENT_DETAIL.analysis_report!.anomalies,
  summary: MOCK_DOCUMENT_DETAIL.analysis_report!.summary,
  completeness: MOCK_DOCUMENT_DETAIL.analysis_report!.completeness,
  documentInfo: MOCK_DOCUMENT_DETAIL.analysis_report!.documentInfo,
}

// ---------------------------------------------------------------------------
// Route interception helpers
// ---------------------------------------------------------------------------

async function interceptDocumentsAPI(page: import('@playwright/test').Page) {
  // List documents
  await page.route('**/api/v1/documents?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ documents: MOCK_DOCUMENTS, total: MOCK_DOCUMENTS.length }),
    })
  )
  await page.route('**/api/v1/documents', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: MOCK_DOCUMENTS, total: MOCK_DOCUMENTS.length }),
      })
    }
    return route.continue()
  })

  // Single document detail
  await page.route('**/api/v1/documents/doc-001', (route) => {
    if (route.request().url().includes('/status') || route.request().url().includes('/analysis')) {
      return route.continue()
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DOCUMENT_DETAIL),
    })
  })

  // Document status
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
      body: JSON.stringify(MOCK_ANALYSIS),
    })
  )

  // Delete document
  await page.route('**/api/v1/documents/*/retry', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    })
  )

  // Delete document
  await page.route('**/api/v1/documents/*', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      })
    }
    // GET for individual document
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DOCUMENT_DETAIL),
    })
  })
}

// ---------------------------------------------------------------------------
// Auth helper
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

test.describe('Document management flows', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await interceptDocumentsAPI(page)
    await signIn(page, context)
  })

  test.describe('Document list', () => {
    test('documents page loads with table', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      // Verify documents are shown in the table
      await expect(page.getByText('mortgage_statement_jan.pdf')).toBeVisible()
      await expect(page.getByText('bank_statement_feb.pdf')).toBeVisible()
      await expect(page.getByText('tax_return_2025.pdf')).toBeVisible()
      await expect(page.getByText('servicer_letter.pdf')).toBeVisible()
    })

    test('document filters render', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      // Search input
      await expect(page.getByPlaceholder('Search documents...')).toBeVisible()

      // Select dropdowns (type, status, sort, severity)
      const selectTriggers = page.locator('button[role="combobox"]')
      // Should have type, status, sort, and severity dropdowns
      await expect(selectTriggers.first()).toBeVisible()
      const count = await selectTriggers.count()
      expect(count).toBeGreaterThanOrEqual(3)
    })

    test('search filter works', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      const searchInput = page.getByPlaceholder('Search documents...')
      await searchInput.fill('mortgage')
      // Wait for debounce
      await page.waitForTimeout(400)

      // mortgage_statement_jan.pdf should still be visible
      await expect(page.getByText('mortgage_statement_jan.pdf')).toBeVisible()
      // bank_statement_feb.pdf should be hidden by the search filter
      await expect(page.getByText('bank_statement_feb.pdf')).not.toBeVisible()
    })

    test('status filter works', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      // Open the status filter dropdown (second combobox)
      const selectTriggers = page.locator('button[role="combobox"]')
      // The status filter is the second select trigger (after type)
      const statusTrigger = selectTriggers.nth(1)
      await statusTrigger.click()

      // Select "Failed" option
      await page.getByRole('option', { name: /failed/i }).click()

      // Only the failed document should be visible
      await expect(page.getByText('tax_return_2025.pdf')).toBeVisible()
      await expect(page.getByText('mortgage_statement_jan.pdf')).not.toBeVisible()
    })
  })

  test.describe('Batch operations', () => {
    test('select-all checkbox works', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      // Find the header checkbox (select-all)
      const headerCheckbox = page.locator('thead input[type="checkbox"]')
      await expect(headerCheckbox).toBeVisible()

      // Click select-all
      await headerCheckbox.click()

      // The selection indicator should show the count
      await expect(page.getByText(/\d+ selected/)).toBeVisible()
    })

    test('batch action bar appears on selection', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      // Select the first document's checkbox
      const rowCheckboxes = page.locator('tbody input[type="checkbox"]')
      await rowCheckboxes.first().click()

      // Batch action bar should appear with delete and re-analyze buttons
      await expect(page.getByText(/document\(s\) selected/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /re-analyze/i })).toBeVisible()
    })

    test('batch delete shows confirmation dialog', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      // Select a document
      const rowCheckboxes = page.locator('tbody input[type="checkbox"]')
      await rowCheckboxes.first().click()

      // Click the delete button
      await page.getByRole('button', { name: /delete/i }).click()

      // Confirmation dialog should appear
      await expect(page.getByRole('heading', { name: /delete.*document/i })).toBeVisible()
      await expect(page.getByText(/cannot be undone/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
    })
  })

  test.describe('Document detail', () => {
    test('document detail page shows info card', async ({ page }) => {
      await page.goto('/dashboard/documents/doc-001')
      await page.waitForLoadState('networkidle')

      // Verify heading shows file name
      await expect(page.getByRole('heading', { name: 'mortgage_statement_jan.pdf' })).toBeVisible()

      // Verify info card
      await expect(page.getByText('Document Information')).toBeVisible()
      await expect(page.getByText('mortgage_statement', { exact: true })).toBeVisible()
    })

    test('document detail shows analysis results', async ({ page }) => {
      await page.goto('/dashboard/documents/doc-001')
      await page.waitForLoadState('networkidle')

      // Verify analysis summary card
      await expect(page.getByText('Analysis Summary')).toBeVisible()

      // Verify anomalies count
      await expect(page.getByText('2 found')).toBeVisible()

      // Verify anomalies table
      await expect(page.getByText('Anomalies (2)')).toBeVisible()
      await expect(page.getByText('Escrow amount mismatch')).toBeVisible()
      await expect(page.getByText('Interest rate does not match contract')).toBeVisible()
    })

    test('document detail shows action buttons', async ({ page }) => {
      await page.goto('/dashboard/documents/doc-001')
      await page.waitForLoadState('networkidle')

      // Verify re-analyze and delete buttons
      await expect(page.getByRole('button', { name: /re-analyze/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
    })
  })
})
