# E2E Tests

End-to-end tests for the Mortgage Guardian frontend using [Playwright](https://playwright.dev/).

## Prerequisites

Install browsers (one-time setup):

```bash
npx playwright install
```

## Running Tests

```bash
# Run all tests (chromium, firefox, webkit)
npx playwright test

# Run chromium only (fastest)
npx playwright test --project=chromium

# Run a specific test file
npx playwright test smoke.spec.ts --project=chromium

# Run in headed mode (see the browser)
npx playwright test --headed --project=chromium

# Run with UI mode for debugging
npx playwright test --ui
```

## Viewing Reports

After a test run:

```bash
npx playwright show-report
```

## Authentication

Some tests require Clerk test credentials. Set the following environment
variables before running auth-dependent tests:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dev instance publishable key |
| `CLERK_SECRET_KEY` | Clerk dev instance secret key |

Tests that require authentication are marked with `test.skip` when
credentials are not available.

## CI

In CI, only chromium is used to keep pipeline times low. The full
cross-browser suite should be run locally before merging.
