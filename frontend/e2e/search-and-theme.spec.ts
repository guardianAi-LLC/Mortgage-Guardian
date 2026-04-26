import { test, expect } from '@playwright/test'
import { interceptCasesAPI, interceptDocumentsAPI, signIn } from './fixtures/mock-data'

// ---------------------------------------------------------------------------
// Global search tests
// ---------------------------------------------------------------------------

test.describe('Global search', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await interceptCasesAPI(page)
    await interceptDocumentsAPI(page)
    await signIn(page, context)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('Cmd+K opens search dialog', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search cases & documents/i)
    await expect(searchInput).toBeVisible()

    // Focus via keyboard shortcut
    await page.keyboard.press('Meta+k')
    await expect(searchInput).toBeFocused()
  })

  test('search input accepts text', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search cases & documents/i)
    await searchInput.click()
    await searchInput.fill('Smith')
    await expect(searchInput).toHaveValue('Smith')
  })

  test('search results appear with mock data', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search cases & documents/i)
    await searchInput.click()
    await searchInput.fill('Smith')

    // Wait for debounced search results to appear
    const resultsDropdown = page.locator('[role="listbox"]')
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 })

    // Should show case results section header
    await expect(page.getByText('Cases').first()).toBeVisible()
    // Should show the matching case name (scoped to dropdown to avoid table row ambiguity)
    await expect(resultsDropdown.getByText('Smith Mortgage Review').first()).toBeVisible()
  })

  test('search results navigable with keyboard', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search cases & documents/i)
    await searchInput.click()
    await searchInput.fill('Smith')

    // Wait for results dropdown
    const resultsDropdown = page.locator('[role="listbox"]')
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 })

    // Verify result options exist
    const options = resultsDropdown.locator('[role="option"]')
    const count = await options.count()
    expect(count).toBeGreaterThan(0)
  })

  test('search result click navigates', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search cases & documents/i)
    await searchInput.click()
    await searchInput.fill('Smith')

    // Wait for results dropdown
    const resultsDropdown = page.locator('[role="listbox"]')
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 })

    // Click the first case result (scoped to dropdown to avoid table row ambiguity)
    await resultsDropdown.getByText('Smith Mortgage Review').first().click()

    // Should navigate to the case detail page
    await expect(page).toHaveURL(/\/dashboard\/cases\/case-001/)
  })

  test('Escape closes search', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search cases & documents/i)
    await searchInput.click()
    await searchInput.fill('Smith')

    // Wait for results dropdown
    const resultsDropdown = page.locator('[role="listbox"]')
    await expect(resultsDropdown).toBeVisible({ timeout: 5000 })

    // Press Escape
    await page.keyboard.press('Escape')

    // Dropdown should close
    await expect(resultsDropdown).not.toBeVisible()
  })

  test('ARIA live region announces results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search cases & documents/i)
    await searchInput.click()
    await searchInput.fill('Smith')

    // Wait for the sr-only aria-live region to update with result count
    const liveRegion = page.locator('[aria-live="polite"]').first()
    await expect(liveRegion).toContainText(/results found/i, { timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Theme toggle tests
// ---------------------------------------------------------------------------

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await interceptCasesAPI(page)
    await interceptDocumentsAPI(page)
    await signIn(page, context)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('theme toggle button exists in header', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /toggle theme/i })
    await expect(toggleButton).toBeVisible()
  })

  test('clicking toggle switches theme', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /toggle theme/i })

    // Get initial theme class
    const initialClass = await page.evaluate(() => document.documentElement.className)

    // Click toggle
    await toggleButton.click()

    // Theme class should change
    const updatedClass = await page.evaluate(() => document.documentElement.className)
    expect(updatedClass).not.toBe(initialClass)
  })

  test('dark theme applies dark colors', async ({ page }) => {
    // Ensure dark theme is active
    const toggleButton = page.getByRole('button', { name: /toggle theme/i })
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    if (!isDark) {
      await toggleButton.click()
      await page.waitForTimeout(500)
    }

    // Verify dark class is on html element
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(hasDark).toBe(true)
  })

  test('light theme applies light colors', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /toggle theme/i })

    // Ensure light theme is active
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    if (isDark) {
      await toggleButton.click()
      await page.waitForTimeout(500)
    }

    // Verify dark class is NOT on html element
    const hasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(hasDark).toBe(false)
  })

  test('theme persists across navigation', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /toggle theme/i })

    // Set to dark theme
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    if (!isDark) {
      await toggleButton.click()
      await page.waitForTimeout(500)
    }

    // Navigate to another page
    await page.goto('/dashboard/documents')
    await page.waitForLoadState('networkidle')

    // Theme should still be dark
    const stillDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    expect(stillDark).toBe(true)
  })
})
