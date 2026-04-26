import { test, expect } from '@playwright/test'
import { signIn } from './fixtures/mock-data'

test.describe('Authentication', () => {
  test('unauthenticated user redirected to sign-in from dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/sign-in**')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('unauthenticated user redirected from nested routes', async ({ page }) => {
    await page.goto('/dashboard/documents')
    await page.waitForURL('**/sign-in**')
    await expect(page).toHaveURL(/sign-in/)
  })

  test('homepage is publicly accessible', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Mortgage Guardian')
  })

  test('sign-in page renders', async ({ page }) => {
    await page.goto('/sign-in')
    await expect(page).toHaveURL(/sign-in/)
    // Clerk renders a sign-in widget with a heading inside it
    await expect(
      page.locator('.cl-signIn-root, .cl-rootBox').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('sign-up page renders', async ({ page }) => {
    await page.goto('/sign-up')
    await expect(page).toHaveURL(/sign-up/)
    // Clerk renders a sign-up widget with a heading inside it
    await expect(
      page.locator('.cl-signUp-root, .cl-rootBox').first()
    ).toBeVisible({ timeout: 15_000 })
  })

  test('authenticated user accesses dashboard', async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')

    await signIn(page, context)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
  })

  test('authenticated user sees profile in sidebar', async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')

    await signIn(page, context)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    // Clerk UserButton renders in the header; verify it is present
    await expect(
      page.locator('.cl-userButtonTrigger, .cl-avatarBox, [data-clerk-component="UserButton"]')
    ).toBeVisible({ timeout: 10_000 })
  })
})
