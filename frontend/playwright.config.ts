import { defineConfig, devices } from '@playwright/test'
import { config as dotenvConfig } from 'dotenv'
import path from 'path'

// Load .env.local so CLERK_SECRET_KEY and other vars are available during test runs
dotenvConfig({ path: path.resolve(__dirname, '.env.local') })

/**
 * Playwright configuration for Mortgage Guardian frontend E2E tests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Limit workers locally to avoid Clerk API rate limits on concurrent sign-in token creation
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,

  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 10_000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
