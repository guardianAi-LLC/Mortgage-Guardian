import type { Page, BrowserContext } from '@playwright/test'
import { setupClerkTestingToken } from '@clerk/testing/playwright'

/**
 * Set up Clerk authentication bypass for E2E tests.
 *
 * This uses @clerk/testing's `setupClerkTestingToken` to inject a testing
 * token that bypasses Clerk's bot protection. It requires the following
 * environment variables:
 *
 * - CLERK_SECRET_KEY — your Clerk dev instance secret key
 * - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — your Clerk dev instance publishable key
 *
 * Run `npx playwright test` with these env vars set, or add them to a
 * `.env.test` file that your test runner loads.
 *
 * @example
 * ```ts
 * import { test } from '@playwright/test'
 * import { setupAuth } from './helpers/auth'
 *
 * test('authenticated page', async ({ page, context }) => {
 *   await setupAuth(page, context)
 *   await page.goto('/dashboard')
 * })
 * ```
 */
export async function setupAuth(page: Page, context: BrowserContext): Promise<void> {
  await setupClerkTestingToken({ page, context })
}
