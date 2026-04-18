import { test, expect } from '@playwright/test'
import { interceptPlaidAPI, mockPlaidAccounts, mockTransactions, signIn } from './fixtures/mock-data'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed localStorage with a fake Plaid access token so the page renders linked accounts. */
async function seedPlaidToken(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('mg_plaid_access_tokens', JSON.stringify(['access-sandbox-test-token']))
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Bank accounts page', () => {
  test.beforeEach(async ({ page, context }) => {
    test.skip(!process.env.CLERK_SECRET_KEY, 'Requires CLERK_SECRET_KEY to be set')
    await interceptPlaidAPI(page)
    await signIn(page, context)
  })

  test('bank accounts page loads with heading', async ({ page }) => {
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Bank Accounts' })).toBeVisible()
    await expect(page.getByText('Link and manage your bank accounts')).toBeVisible()
  })

  test('link bank account button renders', async ({ page }) => {
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    // The PlaidLinkButton renders with text "Link Bank Account"
    const linkButton = page.getByRole('button', { name: /link bank account/i })
    await expect(linkButton.first()).toBeVisible()
  })

  test('linked account cards display', async ({ page }) => {
    await seedPlaidToken(page)
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    // Institution name from mock
    await expect(page.getByText('First National Bank')).toBeVisible()

    // Account names and last 4 digits from mockPlaidAccounts
    const accounts = mockPlaidAccounts()
    for (const acct of accounts) {
      await expect(page.getByText(acct.name, { exact: false }).first()).toBeVisible()
      await expect(page.getByText(`****${acct.mask}`).first()).toBeVisible()
    }
  })

  test('account card expands to show details', async ({ page }) => {
    await seedPlaidToken(page)
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    const accounts = mockPlaidAccounts()

    // Click on the first account to expand it
    const firstAccountButton = page.getByRole('button', { name: new RegExp(accounts[0].name) })
    await firstAccountButton.click()

    // Verify expanded details
    await expect(page.getByText('Type')).toBeVisible()
    await expect(page.getByText('Subtype')).toBeVisible()
    await expect(page.getByText('Available')).toBeVisible()
    await expect(page.getByText('Current')).toBeVisible()
  })

  test('unlink button shows confirmation dialog', async ({ page }) => {
    await seedPlaidToken(page)
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    // Click unlink button (trash icon)
    const unlinkButton = page.getByRole('button', { name: /unlink bank account/i })
    await unlinkButton.click()

    // Confirmation dialog should appear
    await expect(page.getByRole('heading', { name: /unlink bank account/i })).toBeVisible()
    await expect(page.getByText(/cannot be undone/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^unlink$/i })).toBeVisible()
  })

  test('transactions section renders', async ({ page }) => {
    await seedPlaidToken(page)
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    // Verify transaction section heading
    await expect(page.getByText('Recent Transactions')).toBeVisible()

    // Verify table headers
    await expect(page.getByRole('columnheader', { name: /description/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()

    // Verify mock transaction data appears
    const transactions = mockTransactions()
    await expect(page.getByText(transactions[0].name, { exact: false })).toBeVisible()
  })

  test('transaction filters render', async ({ page }) => {
    await seedPlaidToken(page)
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    // Date filters
    await expect(page.getByText('Start Date')).toBeVisible()
    await expect(page.getByText('End Date')).toBeVisible()

    // Amount filters
    await expect(page.getByText('Min Amount')).toBeVisible()
    await expect(page.getByText('Max Amount')).toBeVisible()

    // Verify the inputs exist
    const dateInputs = page.locator('input[type="date"]')
    await expect(dateInputs).toHaveCount(2)

    const numberInputs = page.locator('input[type="number"]')
    await expect(numberInputs).toHaveCount(2)
  })

  test('empty state when no accounts linked', async ({ page }) => {
    // Do NOT seed plaid token => no accounts
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No linked accounts')).toBeVisible()
    await expect(page.getByText(/link a bank account/i)).toBeVisible()
  })
})
