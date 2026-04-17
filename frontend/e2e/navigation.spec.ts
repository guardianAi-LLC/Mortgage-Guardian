import { test, expect } from '@playwright/test'

const hasClerkCredentials = !!process.env.CLERK_SECRET_KEY

test.describe('Navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!hasClerkCredentials, 'Requires CLERK_SECRET_KEY to be set')
    const { setupAuth } = await import('./helpers/auth')
    await setupAuth(page, context)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('sidebar shows all navigation links', async ({ page }) => {
    const expectedLinks = [
      'Dashboard',
      'Cases',
      'Documents',
      'Analytics',
      'Bank Accounts',
      'Settings',
    ]
    for (const label of expectedLinks) {
      await expect(page.getByRole('link', { name: label })).toBeVisible()
    }
  })

  test('sidebar link navigates to correct page', async ({ page }) => {
    const routes: Array<{ label: string; path: string }> = [
      { label: 'Cases', path: '/dashboard/cases' },
      { label: 'Documents', path: '/dashboard/documents' },
      { label: 'Analytics', path: '/dashboard/analytics' },
      { label: 'Bank Accounts', path: '/dashboard/bank-accounts' },
      { label: 'Settings', path: '/dashboard/settings' },
      { label: 'Dashboard', path: '/dashboard' },
    ]
    for (const route of routes) {
      await page.getByRole('link', { name: route.label }).click()
      await expect(page).toHaveURL(new RegExp(route.path.replace('/', '\\/')))
    }
  })

  test('aria-current marks active sidebar link', async ({ page }) => {
    await page.getByRole('link', { name: 'Documents' }).click()
    await expect(page).toHaveURL(/\/dashboard\/documents/)
    const documentsLink = page.getByRole('link', { name: 'Documents' })
    await expect(documentsLink).toHaveAttribute('aria-current', 'page')
    // Dashboard link should not be marked active
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' })
    await expect(dashboardLink).not.toHaveAttribute('aria-current', 'page')
  })

  test('skip-to-content link works', async ({ page }) => {
    // Tab into the page to reach the skip link
    await page.keyboard.press('Tab')
    const skipLink = page.getByRole('link', { name: 'Skip to content' })
    await expect(skipLink).toBeFocused()
    await page.keyboard.press('Enter')
    // Verify focus moved to main content area
    const main = page.locator('#main-content')
    await expect(main).toBeFocused()
  })
})

test.describe('Dashboard page', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!hasClerkCredentials, 'Requires CLERK_SECRET_KEY to be set')
    const { setupAuth } = await import('./helpers/auth')
    await setupAuth(page, context)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('dashboard shows cases table or empty state', async ({ page }) => {
    // Either the case table has rows or there is an empty state message
    const caseRows = page.getByRole('row')
    const emptyState = page.getByText(/no cases yet/i).or(page.getByText(/no cases match/i))
    const hasRows = await caseRows.count() > 1 // header row + at least one data row
    const hasEmpty = await emptyState.isVisible().catch(() => false)
    expect(hasRows || hasEmpty).toBe(true)
  })

  test('dashboard shows stats cards', async ({ page }) => {
    await expect(page.getByText('Total Cases')).toBeVisible()
    await expect(page.getByText('Active Cases')).toBeVisible()
    await expect(page.getByText('Documents')).toBeVisible()
    await expect(page.getByText('Findings')).toBeVisible()
  })

  test('dashboard pagination works', async ({ page }) => {
    // Pagination only appears when there are cases
    const emptyState = page.getByText(/no cases yet/i)
    const isEmpty = await emptyState.isVisible().catch(() => false)
    if (isEmpty) {
      test.skip(true, 'No cases available to test pagination')
      return
    }
    // Verify pagination controls exist
    const prevButton = page.getByRole('button', { name: /previous/i })
    const nextButton = page.getByRole('button', { name: /next/i })
    await expect(prevButton.or(nextButton).first()).toBeVisible()
  })

  test('case filters render', async ({ page }) => {
    // Search input
    await expect(
      page.getByRole('textbox', { name: /search/i }).or(page.getByPlaceholder(/search/i))
    ).toBeVisible()
    // Status filter
    await expect(
      page.getByRole('combobox').or(page.getByLabel(/status/i)).first()
    ).toBeVisible()
  })
})
