/**
 * Per-User Rate Limiter for Plaid Resolution Endpoints (Phase 54-05)
 *
 * The token-resolution endpoints (GET /v1/plaid/items, POST /accounts,
 * POST /transactions, POST /item) each trigger a server-side token
 * decryption. A per-user budget (default 60 requests / 5 minutes) covers a
 * UI that polls bank state without enabling item enumeration or decrypt
 * amplification. Keys on the authenticated Clerk user id; unauthenticated
 * requests (which requireAuth rejects anyway) fall back to the client IP.
 *
 * Env tunables:
 *   PLAID_RESOLVE_RATE_LIMIT_MAX        - max requests per window (default 60)
 *   PLAID_RESOLVE_RATE_LIMIT_WINDOW_MS  - window in ms (default 300000 = 5 min)
 *
 * On limit: 429 with Retry-After + standard RateLimit headers
 * (standardHeaders: true makes express-rate-limit emit both).
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const DEFAULT_MAX = 60;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Build the limiter. Options override env, env overrides defaults —
 * the factory shape keeps unit tests independent of process env.
 *
 * @param {{ max?: number, windowMs?: number }} [options]
 * @returns {import('express').RequestHandler}
 */
function createPlaidResolveLimiter(options = {}) {
  const windowMs = options.windowMs
    || parseInt(process.env.PLAID_RESOLVE_RATE_LIMIT_WINDOW_MS, 10)
    || DEFAULT_WINDOW_MS;
  const max = options.max
    || parseInt(process.env.PLAID_RESOLVE_RATE_LIMIT_MAX, 10)
    || DEFAULT_MAX;

  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: true, // RateLimit-* headers + Retry-After on 429
    legacyHeaders: false,
    keyGenerator: (req) =>
      (req.user && req.user.id) ? `user:${req.user.id}` : ipKeyGenerator(req.ip),
    message: {
      error: 'rate_limited',
      message: 'Too many Plaid requests for this user. Please try again later.'
    }
  });
}

module.exports = { createPlaidResolveLimiter };
