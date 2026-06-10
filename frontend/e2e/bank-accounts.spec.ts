import { test, expect } from '@playwright/test'
import {
  interceptPlaidAPI,
  mockPlaidAccounts,
  mockTransactions,
  signIn,
} from './fixtures/mock-data'

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
    // Use the "empty items" intercept so the empty state surfaces the CTA.
    await interceptPlaidAPI(page, { empty: true })
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    const linkButton = page.getByRole('button', { name: /link bank account/i })
    await expect(linkButton.first()).toBeVisible()
  })

  test('linked banks render from GET /v1/plaid/items', async ({ page }) => {
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    // Institution name comes from the mocked GET /items response.
    await expect(page.getByText('First National Bank')).toBeVisible()

    // Account names and last 4 digits from mockPlaidAccounts.
    const accounts = mockPlaidAccounts()
    for (const acct of accounts) {
      await expect(page.getByText(acct.name, { exact: false }).first()).toBeVisible()
      await expect(page.getByText(`****${acct.mask}`).first()).toBeVisible()
    }
  })

  test('account card expands to show details', async ({ page }) => {
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    const accounts = mockPlaidAccounts()
    const firstAccountButton = page.getByRole('button', { name: new RegExp(accounts[0].name) })
    await firstAccountButton.click()

    await expect(page.getByText('Type')).toBeVisible()
    await expect(page.getByText('Subtype')).toBeVisible()
    await expect(page.getByText('Available')).toBeVisible()
    await expect(page.getByText('Current')).toBeVisible()
  })

  test('unlink button shows confirmation dialog', async ({ page }) => {
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    const unlinkButton = page.getByRole('button', { name: /unlink bank account/i })
    await unlinkButton.click()

    await expect(page.getByRole('heading', { name: /unlink bank account/i })).toBeVisible()
    await expect(page.getByText(/cannot be undone/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^unlink$/i })).toBeVisible()
  })

  test('transactions section renders', async ({ page }) => {
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Recent Transactions')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /description/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /amount/i })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /status/i })).toBeVisible()

    const transactions = mockTransactions()
    await expect(page.getByText(transactions[0].name, { exact: false })).toBeVisible()
  })

  test('transaction filters render', async ({ page }) => {
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Start Date')).toBeVisible()
    await expect(page.getByText('End Date')).toBeVisible()
    await expect(page.getByText('Min Amount')).toBeVisible()
    await expect(page.getByText('Max Amount')).toBeVisible()

    const dateInputs = page.locator('input[type="date"]')
    await expect(dateInputs).toHaveCount(2)

    const numberInputs = page.locator('input[type="number"]')
    await expect(numberInputs).toHaveCount(2)
  })

  test('empty state when GET /items returns []', async ({ page }) => {
    await interceptPlaidAPI(page, { empty: true })
    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('No linked accounts')).toBeVisible()
    await expect(page.getByText(/link a bank account/i)).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Phase 54-03 security regressions
  // -------------------------------------------------------------------------

  test('no access_token in any /v1/plaid/* request body', async ({ page }) => {
    const offending: { url: string; key: string }[] = []
    page.on('request', (req) => {
      if (!/\/api\/v1\/plaid\//.test(req.url())) return
      const data = req.postData()
      if (!data) return
      let parsed: unknown
      try {
        parsed = JSON.parse(data)
      } catch {
        return
      }
      if (parsed && typeof parsed === 'object') {
        for (const key of Object.keys(parsed as Record<string, unknown>)) {
          if (/access_?token/i.test(key)) {
            offending.push({ url: req.url(), key })
          }
        }
      }
    })

    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    expect(offending, JSON.stringify(offending)).toEqual([])
  })

  test('localStorage migration cleanup: legacy mg_plaid_access_tokens is purged on first render', async ({
    page,
  }) => {
    // Seed the legacy key BEFORE the page boots.
    await page.addInitScript(() => {
      localStorage.setItem(
        'mg_plaid_access_tokens',
        JSON.stringify(['access-sandbox-LEAKY-TOKEN'])
      )
    })

    await page.goto('/dashboard/bank-accounts')
    await page.waitForLoadState('networkidle')

    const remaining = await page.evaluate(() =>
      localStorage.getItem('mg_plaid_access_tokens')
    )
    expect(remaining).toBeNull()
  })
})
