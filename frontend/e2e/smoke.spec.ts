import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Mortgage Guardian')
  })

  test('redirects unauthenticated user to sign-in', async ({ page }) => {
    await page.goto('/dashboard')
    // Clerk middleware should redirect unauthenticated users to the sign-in page
    await page.waitForURL('**/sign-in**')
    await expect(page).toHaveURL(/sign-in/)
  })

  test.skip('authenticated user sees dashboard', async ({ page, context }) => {
    // Requires Clerk test credentials:
    //   CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    // See e2e/README.md for setup instructions.
    const { setupAuth } = await import('./helpers/auth')
    await setupAuth(page, context)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, h2, [role="heading"]')).toBeVisible()
  })
})
