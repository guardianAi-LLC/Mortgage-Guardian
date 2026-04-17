import { test as base, expect } from '@playwright/test'

export { expect }
export const test = base

/**
 * Wait for the dashboard page to fully load after navigation.
 */
export async function waitForDashboard(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForURL('**/dashboard**')
  await page.waitForLoadState('networkidle')
}

/**
 * Navigate to a route using the app's base URL.
 */
export async function navigateTo(
  page: import('@playwright/test').Page,
  path: string,
): Promise<void> {
  await page.goto(path)
  await page.waitForLoadState('domcontentloaded')
}
