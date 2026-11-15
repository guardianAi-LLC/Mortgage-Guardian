/**
 * CSRF Origin Guard Middleware — Defense-in-Depth CSRF Protection
 *
 * The API is bearer-JWT today (naturally CSRF-resistant), but Helmet + CORS alone
 * don't reject mismatched-Origin browser requests on state-changing verbs. This
 * middleware adds an Origin/Referer gate as a durable backstop before any future
 * cookie-based session surfaces are introduced.
 *
 * Behavior:
 *   - GET/HEAD/OPTIONS → bypass (read-only / preflight)
 *   - Authorization: Bearer … present → bypass (bearer clients are CSRF-immune;
 *     iOS app & server-to-server callers unaffected)
 *   - Path matches options.exemptPaths (string or RegExp) → bypass
 *     (used to exempt Plaid webhook, which has no Origin header from Plaid servers
 *     and is already signature-verified)
 *   - Otherwise: require Origin (or Referer's origin) to match options.allowedOrigins.
 *     Mismatch or missing → 403 { error: 'csrf_origin_mismatch', ... }
 *
 * Stateless — no cookies, no session store. Vercel-friendly.
 *
 * Usage:
 *   const { csrfOriginGuard } = require('./middleware/csrfOriginGuard');
 *   app.use(csrfOriginGuard({
 *     allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
 *     exemptPaths: ['/v1/plaid/webhook'],
 *   }));
 */

const { createLogger } = require('../utils/logger');

const logger = createLogger('security');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Extract the origin (scheme + host[:port]) from a Referer URL.
 * Returns null if the Referer is missing or unparseable.
 */
function refererOrigin(referer) {
    if (!referer) return null;
    try {
        const u = new URL(referer);
        return `${u.protocol}//${u.host}`;
    } catch {
        return null;
    }
}

/**
 * Check whether a request path matches any exempt entry.
 * Entries may be exact-match strings or RegExp.
 */
function isExempt(path, exemptPaths) {
    for (const entry of exemptPaths) {
        if (entry instanceof RegExp) {
            if (entry.test(path)) return true;
        } else if (typeof entry === 'string') {
            if (path === entry) return true;
        }
    }
    return false;
}

/**
 * Create the csrfOriginGuard middleware.
 *
 * @param {Object} options
 * @param {string[]} [options.allowedOrigins=[]] - List of allowed origins (e.g., 'https://app.example.com').
 * @param {Array<string|RegExp>} [options.exemptPaths=[]] - Paths to bypass entirely.
 * @returns {import('express').RequestHandler}
 */
function csrfOriginGuard(options = {}) {
    const allowedOrigins = new Set(options.allowedOrigins || []);
    const exemptPaths = options.exemptPaths || [];

    return function csrfOriginGuardMiddleware(req, res, next) {
        // Safe verbs and preflight bypass
        if (SAFE_METHODS.has(req.method)) {
            return next();
        }

        // Bearer-token clients bypass (iOS, server-to-server, anything not a cookie-bearing browser)
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
            return next();
        }

        // Path-based exemption (e.g., signature-verified webhooks)
        if (isExempt(req.path, exemptPaths)) {
            return next();
        }

        // Origin check (with Referer fallback)
        const origin = req.headers.origin || null;
        const referer = req.headers.referer || req.headers.referrer || null;
        const candidate = origin || refererOrigin(referer);

        if (candidate && allowedOrigins.has(candidate)) {
            return next();
        }

        logger.warn('csrf_origin_rejected', {
            method: req.method,
            path: req.path,
            origin,
            referer,
            requestId: req.requestId
        });

        return res.status(403).json({
            error: 'csrf_origin_mismatch',
            message: 'Origin header missing or not allowed'
        });
    };
}

module.exports = { csrfOriginGuard };
