import { test, expect } from '@playwright/test'
import { mockCase, mockCasesList, interceptCasesAPI, signIn } from './fixtures/mock-data'

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

      const cases = mockCasesList()
      await expect(page.getByText(cases[0].case_name)).toBeVisible()
      await expect(page.getByText(cases[1].case_name)).toBeVisible()
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
      await page.waitForTimeout(400)
      await expect(page.getByText('Smith Mortgage Review')).toBeVisible()
    })

    test('new case button navigates to form', async ({ page }) => {
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

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

      const submitButton = page.getByRole('button', { name: /create case/i })
      await expect(submitButton).toBeDisabled()

      const caseNameInput = page.getByLabel(/case name/i)
      await caseNameInput.fill('Test')
      await expect(submitButton).toBeEnabled()
      await caseNameInput.clear()
      await expect(submitButton).toBeDisabled()
    })

    test('case form submits successfully', async ({ page }) => {
      await page.route('**/api/v1/cases/case-new-001', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCase({
            id: 'case-new-001',
            case_name: 'Test Case',
            borrower_name: 'John Doe',
            documents: [],
          })),
        })
      )

      await page.goto('/dashboard/cases/new')
      await page.waitForLoadState('networkidle')

      await page.getByLabel(/case name/i).fill('Test Case')
      await page.getByLabel(/borrower name/i).fill('John Doe')
      await page.getByLabel(/property address/i).fill('100 Test St')
      await page.getByLabel(/loan number/i).fill('LOAN-TEST-001')
      await page.getByLabel(/servicer name/i).fill('Test Servicer')

      await page.getByRole('button', { name: /create case/i }).click()
      await page.waitForURL('**/dashboard/cases/case-new-001')
    })
  })

  test.describe('Case detail', () => {
    test('case detail page shows case info', async ({ page }) => {
      await page.goto('/dashboard/cases/case-001')
      await page.waitForLoadState('networkidle')

      const c = mockCase()
      await expect(page.getByRole('heading', { name: c.case_name })).toBeVisible()
      await expect(page.getByText('Case Information')).toBeVisible()
      await expect(page.getByText(c.borrower_name)).toBeVisible()
      await expect(page.getByText(c.property_address)).toBeVisible()
      await expect(page.getByText(c.loan_number)).toBeVisible()
      await expect(page.getByText(c.servicer_name)).toBeVisible()
    })

    test('case analysis page loads', async ({ page }) => {
      await page.goto('/dashboard/cases/case-001/analysis')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { name: /analysis/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /forensic/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /compliance/i })).toBeVisible()
    })

    test('case report page loads', async ({ page }) => {
      await page.goto('/dashboard/cases/case-001/report')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('heading', { name: /consolidated report/i })).toBeVisible()
      await expect(page.getByText(/no report generated/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /generate report/i })).toBeVisible()
    })
  })
})
