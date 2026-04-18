import { test, expect } from '@playwright/test'
import {
  interceptCasesAPI,
  interceptDocumentsAPI,
  interceptAnalyticsAPI,
  mockEmptyAnalyticsData,
  signIn,
} from './fixtures/mock-data'

// ---------------------------------------------------------------------------
// Empty state tests
// ---------------------------------------------------------------------------

test.describe('Empty states', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await signIn(page, context)
  })

  test('dashboard shows empty state when no cases', async ({ page }) => {
    // Intercept cases API with empty data
    await page.route('**/api/v1/cases?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cases: [], total: 0 }),
      })
    )
    await page.route('**/api/v1/cases', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cases: [], total: 0 }),
      })
    )

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Empty state message
    await expect(page.getByText('No cases yet')).toBeVisible()
    await expect(page.getByText(/create your first case/i)).toBeVisible()
  })

  test('documents page shows empty state', async ({ page }) => {
    // Intercept documents API with empty data
    await page.route('**/api/v1/documents?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [], total: 0 }),
      })
    )
    await page.route('**/api/v1/documents', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [], total: 0 }),
      })
    )

    await page.goto('/dashboard/documents')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No documents yet')).toBeVisible()
    await expect(page.getByText(/upload documents to a case/i)).toBeVisible()
  })

  test('analytics shows empty state', async ({ page }) => {
    await interceptAnalyticsAPI(page, mockEmptyAnalyticsData())

    await page.goto('/dashboard/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No analytics data')).toBeVisible()
    await expect(page.getByText(/create cases and analyze documents/i)).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Loading state tests
// ---------------------------------------------------------------------------

test.describe('Loading states', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await signIn(page, context)
  })

  test('dashboard shows loading skeleton', async ({ page }) => {
    // Delay API response to catch loading state
    await page.route('**/api/v1/cases?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cases: [], total: 0 }),
      })
    })
    await page.route('**/api/v1/cases', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cases: [], total: 0 }),
      })
    })

    await page.goto('/dashboard')

    // Skeleton elements should appear while loading
    const skeletons = page.locator('[class*="skeleton"], [class*="Skeleton"]')
    await expect(skeletons.first()).toBeVisible({ timeout: 5000 })
  })

  test('documents page shows loading skeleton', async ({ page }) => {
    // Delay API response to catch loading state
    await page.route('**/api/v1/documents?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [], total: 0 }),
      })
    })
    await page.route('**/api/v1/documents', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ documents: [], total: 0 }),
      })
    })

    await page.goto('/dashboard/documents')

    // Should show loading state with skeleton or aria-busy
    const loadingIndicator = page.locator('[aria-busy="true"], [class*="skeleton"], [class*="Skeleton"]')
    await expect(loadingIndicator.first()).toBeVisible({ timeout: 5000 })
  })
})

// ---------------------------------------------------------------------------
// Error state tests
// ---------------------------------------------------------------------------

test.describe('Error states', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await signIn(page, context)
  })

  test('dashboard handles API error gracefully', async ({ page }) => {
    // Intercept cases API with 500 error
    await page.route('**/api/v1/cases?*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    )
    await page.route('**/api/v1/cases', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    )

    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    // Page should still render (not blank) — sidebar should be visible
    const sidebar = page.locator('nav, [role="navigation"]')
    await expect(sidebar.first()).toBeVisible()

    // The page should not show a blank white page — heading should still render
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('documents page handles API error', async ({ page }) => {
    // Intercept documents API with 500 error
    await page.route('**/api/v1/documents?*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    )
    await page.route('**/api/v1/documents', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    )

    await page.goto('/dashboard/documents')
    await page.waitForLoadState('networkidle')

    // Should show error message, not blank page
    await expect(page.getByText(/failed to load documents/i)).toBeVisible()

    // Retry button should be available
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
  })

  test('document detail handles 404', async ({ page }) => {
    // Intercept document API with 404 error
    await page.route('**/api/v1/documents/nonexistent-doc', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      })
    )
    await page.route('**/api/v1/documents/nonexistent-doc/status', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      })
    )
    await page.route('**/api/v1/documents/nonexistent-doc/analysis', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not found' }),
      })
    )

    await page.goto('/dashboard/documents/nonexistent-doc')
    await page.waitForLoadState('networkidle')

    // Should show error or not-found state
    const errorText = page.getByText(/failed to load document|document not found/i)
    await expect(errorText.first()).toBeVisible({ timeout: 10000 })
  })
})

// ---------------------------------------------------------------------------
// Network failure test
// ---------------------------------------------------------------------------

test.describe('Network failure', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await signIn(page, context)
  })

  test('handles network failure', async ({ page }) => {
    // Abort all API requests to simulate network failure
    await page.route('**/api/v1/**', (route) => route.abort('connectionfailed'))

    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')

    // Page should still render — not crash
    const sidebar = page.locator('nav, [role="navigation"]')
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 })

    // Dashboard heading should still be visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })
})
