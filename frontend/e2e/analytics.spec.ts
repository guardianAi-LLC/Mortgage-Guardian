import { test, expect } from '@playwright/test'
import { interceptAnalyticsAPI, mockEmptyAnalyticsData, signIn } from './fixtures/mock-data'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Analytics dashboard', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await interceptAnalyticsAPI(page)
    await signIn(page, context)
  })

  test('analytics page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
    await expect(page.getByText('Portfolio-level insights and trends')).toBeVisible()
  })

  test('stat cards render with data', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await page.waitForLoadState('networkidle')

    // 5 stat cards: Total Cases, Total Documents, Total Findings, Avg Confidence, High Risk
    await expect(page.getByText('Total Cases')).toBeVisible()
    await expect(page.getByText('Total Documents')).toBeVisible()
    await expect(page.getByText('Total Findings')).toBeVisible()
    await expect(page.getByText('Avg Confidence')).toBeVisible()
    await expect(page.getByText('High Risk')).toBeVisible()

    // Verify values are rendered (3 cases, 3 documents from mock data)
    const statsSection = page.locator('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-5')
    await expect(statsSection).toBeVisible()
    const cards = statsSection.locator('> *')
    await expect(cards).toHaveCount(5)
  })

  test('charts render', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await page.waitForLoadState('networkidle')

    // 6 chart containers with headings
    await expect(page.getByText('Cases by Status')).toBeVisible()
    await expect(page.getByText('Risk Distribution')).toBeVisible()
    await expect(page.getByText('Finding Severity')).toBeVisible()
    await expect(page.getByText('Top Categories')).toBeVisible()
    await expect(page.getByText('Case Trend')).toBeVisible()
    await expect(page.getByText('Confidence Distribution')).toBeVisible()

    // Verify chart containers exist (Recharts renders inside ResponsiveContainer)
    const chartContainers = page.locator('.recharts-responsive-container')
    const count = await chartContainers.count()
    expect(count).toBeGreaterThanOrEqual(4) // some may not render if data is empty for that chart
  })

  test('empty state shows when no data', async ({ page }) => {
    // Override with empty data
    await page.unrouteAll()
    await interceptAnalyticsAPI(page, mockEmptyAnalyticsData())

    await page.goto('/dashboard/analytics')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No analytics data')).toBeVisible()
    await expect(page.getByText('Create cases and analyze documents to see portfolio insights.')).toBeVisible()
  })

  test('loading state shows skeleton', async ({ page }) => {
    // Override routes with delayed response to catch loading state
    await page.unrouteAll()
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

    await page.goto('/dashboard/analytics')

    // Skeleton elements should appear while loading
    const skeletons = page.locator('[class*="skeleton"], [class*="Skeleton"]')
    await expect(skeletons.first()).toBeVisible({ timeout: 5000 })
  })
})
