import { clerkSetup } from '@clerk/testing/playwright'

/**
 * Playwright global setup — runs once before all test files.
 *
 * When CLERK_SECRET_KEY is available, calls clerkSetup() to fetch the
 * Clerk Frontend API URL so that setupClerkTestingToken can bypass
 * bot protection in individual tests.
 */
export default async function globalSetup() {
  if (process.env.CLERK_SECRET_KEY) {
    await clerkSetup()
  }
}
