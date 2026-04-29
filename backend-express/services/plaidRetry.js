/**
 * Plaid PRODUCT_NOT_READY retry helper.
 *
 * Plaid sandbox returns PRODUCT_NOT_READY (HTTP 400, type ITEM_ERROR) for
 * the first ~5s after itemPublicTokenExchange while transaction data
 * initializes. Production can also briefly return this on cold items.
 *
 * Strategy: poll every 2s up to a 30s deadline. Any non-PRODUCT_NOT_READY
 * error is rethrown immediately so genuine failures (auth, schema, 5xx)
 * surface without delay.
 *
 * Extracted from backend-express/__tests__/integration/plaid-sandbox-roundtrip.test.js
 * (M001/S03/T04, MEM034) so single-doc audit (M001/S04/T02) reuses the same
 * contract instead of duplicating the loop.
 */

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_DEADLINE_MS = 30000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Heuristic: does this error look like Plaid PRODUCT_NOT_READY?
 *
 * Accepts both the SDK's axios-shaped error (`error.response.data.error_code`)
 * and our own thrown Errors that carry `code` / message text.
 *
 * @param {*} err
 * @returns {boolean}
 */
function isProductNotReady(err) {
  if (!err) return false;
  const sdkCode = err?.response?.data?.error_code;
  if (sdkCode === 'PRODUCT_NOT_READY') return true;
  if (err.code === 'PRODUCT_NOT_READY') return true;
  const msg = err.message || '';
  return /product.*not.*ready/i.test(msg);
}

/**
 * Run an async Plaid operation, retrying only on PRODUCT_NOT_READY.
 *
 * @param {() => Promise<any>} fn - the Plaid call (e.g. () => plaidService.getTransactions(...))
 * @param {Object} [options]
 * @param {number} [options.intervalMs=2000]
 * @param {number} [options.deadlineMs=30000]
 * @param {(info: {attempt: number, elapsedMs: number}) => void} [options.onRetry]
 * @returns {Promise<any>} resolved value of fn
 */
async function withProductReadyRetry(fn, options = {}) {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const deadlineMs = options.deadlineMs ?? DEFAULT_DEADLINE_MS;
  const onRetry = options.onRetry;

  const start = Date.now();
  let attempt = 0;
  let lastError;

  while (Date.now() - start < deadlineMs) {
    attempt += 1;
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isProductNotReady(err)) {
        throw err;
      }
      if (typeof onRetry === 'function') {
        try {
          onRetry({ attempt, elapsedMs: Date.now() - start });
        } catch (_) { /* swallow observer errors */ }
      }
      await sleep(intervalMs);
    }
  }

  // Deadline exceeded — surface the most recent PRODUCT_NOT_READY error.
  throw lastError || new Error('Plaid PRODUCT_NOT_READY: deadline exceeded');
}

module.exports = {
  withProductReadyRetry,
  isProductNotReady,
  DEFAULT_INTERVAL_MS,
  DEFAULT_DEADLINE_MS
};
