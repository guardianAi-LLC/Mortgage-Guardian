import { test, expect } from '@playwright/test'
import { mockDocument, mockDocumentsList, interceptDocumentsAPI, signIn } from './fixtures/mock-data'

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

      const docs = mockDocumentsList()
      for (const doc of docs) {
        await expect(page.getByText(doc.file_name)).toBeVisible()
      }
    })

    test('document filters render', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      await expect(page.getByPlaceholder('Search documents...')).toBeVisible()

      const selectTriggers = page.locator('button[role="combobox"]')
      await expect(selectTriggers.first()).toBeVisible()
      const count = await selectTriggers.count()
      expect(count).toBeGreaterThanOrEqual(3)
    })

    test('search filter works', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      const searchInput = page.getByPlaceholder('Search documents...')
      await searchInput.fill('mortgage')
      await page.waitForTimeout(400)

      await expect(page.getByText('mortgage_statement_jan.pdf')).toBeVisible()
      await expect(page.getByText('bank_statement_feb.pdf')).not.toBeVisible()
    })

    test('status filter works', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      // Open the status filter dropdown (second combobox after type)
      const selectTriggers = page.locator('button[role="combobox"]')
      const statusTrigger = selectTriggers.nth(1)
      await statusTrigger.click()

      await page.getByRole('option', { name: /failed/i }).click()

      await expect(page.getByText('tax_return_2025.pdf')).toBeVisible()
      await expect(page.getByText('mortgage_statement_jan.pdf')).not.toBeVisible()
    })
  })

  test.describe('Batch operations', () => {
    test('select-all checkbox works', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      const headerCheckbox = page.locator('thead input[type="checkbox"]')
      await expect(headerCheckbox).toBeVisible()
      await headerCheckbox.click()

      await expect(page.getByText(/\d+ selected/)).toBeVisible()
    })

    test('batch action bar appears on selection', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      const rowCheckboxes = page.locator('tbody input[type="checkbox"]')
      await rowCheckboxes.first().click()

      await expect(page.getByText(/document\(s\) selected/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /re-analyze/i })).toBeVisible()
    })

    test('batch delete shows confirmation dialog', async ({ page }) => {
      await page.goto('/dashboard/documents')
      await page.waitForLoadState('networkidle')

      const rowCheckboxes = page.locator('tbody input[type="checkbox"]')
      await rowCheckboxes.first().click()

      await page.getByRole('button', { name: /delete/i }).click()

      await expect(page.getByRole('heading', { name: /delete.*document/i })).toBeVisible()
      await expect(page.getByText(/cannot be undone/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
    })
  })

  test.describe('Document detail', () => {
    test('document detail page shows info card', async ({ page }) => {
      await page.goto('/dashboard/documents/doc-001')
      await page.waitForLoadState('networkidle')

      const doc = mockDocument()
      await expect(page.getByRole('heading', { name: doc.file_name })).toBeVisible()
      await expect(page.getByText('Document Information')).toBeVisible()
      await expect(page.getByText('mortgage_statement', { exact: true })).toBeVisible()
    })

    test('document detail shows analysis results', async ({ page }) => {
      await page.goto('/dashboard/documents/doc-001')
      await page.waitForLoadState('networkidle')

      await expect(page.getByText('Analysis Summary')).toBeVisible()
      await expect(page.getByText('2 found')).toBeVisible()
      await expect(page.getByText('Anomalies (2)')).toBeVisible()
      await expect(page.getByText('Escrow amount mismatch')).toBeVisible()
      await expect(page.getByText('Interest rate does not match contract')).toBeVisible()
    })

    test('document detail shows action buttons', async ({ page }) => {
      await page.goto('/dashboard/documents/doc-001')
      await page.waitForLoadState('networkidle')

      await expect(page.getByRole('button', { name: /re-analyze/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
    })
  })
})
