import { test, expect } from '@playwright/test'
import { interceptSettingsAPI, signIn } from './fixtures/mock-data'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Settings page', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await interceptSettingsAPI(page)
    await signIn(page, context)
  })

  test('settings page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Manage your account and preferences')).toBeVisible()
  })

  test('notification toggles render', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    // 3 toggle switches
    await expect(page.getByText('Document processing complete')).toBeVisible()
    await expect(page.getByText('Analysis findings ready')).toBeVisible()
    await expect(page.getByText('Pipeline errors')).toBeVisible()

    // Verify the checkbox inputs exist (sr-only but functional)
    const toggleInputs = page.locator('input[type="checkbox"]')
    const count = await toggleInputs.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('notification toggle persists on reload', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    // Toggle the first preference off (it defaults to true)
    // The input is sr-only; click the associated label to trigger the toggle
    const completeToggle = page.locator('#pref-complete')
    await expect(completeToggle).toBeChecked()
    await page.locator('label[for="pref-complete"]').click()
    await expect(completeToggle).not.toBeChecked()

    // Reload the page and verify state persisted via localStorage
    await page.reload()
    await page.waitForLoadState('networkidle')

    const completeToggleAfter = page.locator('#pref-complete')
    // Wait for client-side mount (toggles are in {mounted && ...} block)
    await expect(completeToggleAfter).toBeVisible({ timeout: 10_000 })
    await expect(completeToggleAfter).not.toBeChecked()

    // Other toggles should still be checked (default true)
    await expect(page.locator('#pref-findings')).toBeChecked()
    await expect(page.locator('#pref-errors')).toBeChecked()
  })

  test('data export button exists', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Data Export')).toBeVisible()
    await expect(page.getByText('Download all your cases, documents, and analysis data as JSON')).toBeVisible()

    const exportButton = page.getByRole('button', { name: /export all data/i })
    await expect(exportButton).toBeVisible()
  })

  test('data export triggers download', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    const exportButton = page.getByRole('button', { name: /export all data/i })

    // Listen for download event
    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()
    const download = await downloadPromise

    // Verify filename pattern
    expect(download.suggestedFilename()).toMatch(/mortgage-guardian-export-.*\.json/)
  })

  test('delete account section renders', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Danger Zone')).toBeVisible()
    await expect(page.getByText(/permanently delete your account/i)).toBeVisible()

    const deleteButton = page.getByRole('button', { name: /delete account/i })
    await expect(deleteButton).toBeVisible()
  })

  test('delete account requires confirmation dialog', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    const deleteButton = page.getByRole('button', { name: /delete account/i })
    await deleteButton.click()

    // Confirmation dialog appears
    await expect(page.getByRole('heading', { name: /delete account/i })).toBeVisible()
    await expect(page.getByText(/type.*DELETE.*to confirm/i)).toBeVisible()
    await expect(page.getByPlaceholder(/type delete to confirm/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()

    // Delete button should be disabled until correct text is typed
    const confirmDeleteButton = page.getByRole('button', { name: /delete my account/i })
    await expect(confirmDeleteButton).toBeDisabled()
  })

  test('delete account rejects wrong confirmation text', async ({ page }) => {
    await page.goto('/dashboard/settings')
    await page.waitForLoadState('networkidle')

    const deleteButton = page.getByRole('button', { name: /delete account/i })
    await deleteButton.click()

    // Type wrong text
    const confirmInput = page.getByPlaceholder(/type delete to confirm/i)
    await confirmInput.fill('delete') // lowercase, should not match 'DELETE'

    const confirmDeleteButton = page.getByRole('button', { name: /delete my account/i })
    await expect(confirmDeleteButton).toBeDisabled()

    // Type partially correct
    await confirmInput.fill('DELET')
    await expect(confirmDeleteButton).toBeDisabled()

    // Type correct text
    await confirmInput.fill('DELETE')
    await expect(confirmDeleteButton).toBeEnabled()
  })
})
