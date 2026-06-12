/**
 * Audit Event Helper
 *
 * Standardized emitter for structured audit-log entries. Every audit event
 * flows through this module so that:
 *
 *   1. Only allow-listed event names can be emitted (prevents typos and
 *      ad-hoc events that bypass downstream log alerting).
 *   2. Sensitive payload keys (tokens, passwords, secrets, API keys) are
 *      defensively stripped before the entry hits the logger — no credential
 *      material in audit logs even if a caller accidentally passes one.
 *   3. Every event carries a `timestamp` ISO-8601 string and an `event` field
 *      mirroring the event name (machine-parseable by log aggregators).
 *
 * Underlying transport is the shared Winston `createLogger('audit')` channel
 * already used by Phase 54-05 (plaidDataService) — we use the same shape so
 * existing dashboards and alerts keep working.
 *
 * Usage:
 *   const { emitAuditEvent } = require('./auditEvent');
 *   emitAuditEvent('auth_failure', { reason: 'missing_token', requestId, route, method });
 */

const { createLogger } = require('./logger');

const auditLogger = createLogger('audit');

/**
 * Frozen allow-list of valid audit event names. Add new events by extending
 * this list — calls with names outside this list throw at runtime so typos
 * are caught early.
 */
const AUDIT_EVENTS = Object.freeze([
  'session_started',
  'session_ended',
  'user_deleted',
  'auth_failure',
  'plaid_token_decrypted',
  'plaid_token_encrypted',
  'plaid_key_rotated'
]);

/**
 * Sensitive-key matching rule (lowercase):
 *
 *   - Exact match against: `password`, `token`, `access_token`, `secret`, `apikey`
 *   - Substring match (whole-word stem) against: `password`, `secret`, `apikey`,
 *     `token` — but ONLY when the key is itself token-shaped. To avoid nuking
 *     legitimate identifiers like `sessionId`/`userId`, we use targeted
 *     substring checks: keys containing `password`, `secret`, `apikey`,
 *     `access_token`, or ending in `_token` / equal to `token` are stripped.
 *
 * This intentionally preserves `sessionId`, `userId`, `itemId` while catching
 * `accessToken`, `access_token`, `apiKey`, `clientSecret`, `clerkToken`, etc.
 */
const SENSITIVE_EXACT = new Set(['password', 'token', 'access_token', 'secret', 'apikey']);

function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  const k = key.toLowerCase();
  if (SENSITIVE_EXACT.has(k)) return true;
  if (k.includes('password')) return true;
  if (k.includes('secret')) return true;
  if (k.includes('apikey')) return true;
  if (k.includes('access_token') || k.includes('accesstoken')) return true;
  // Keys ending in `_token` or `token` (e.g. `bearerToken`, `refreshToken`).
  // Carve-out: do NOT match `sessionId`, `userId`, etc.
  if (k.endsWith('_token') || k.endsWith('token')) return true;
  return false;
}

/**
 * Return a shallow copy of `payload` with sensitive keys stripped. If any
 * keys were stripped, emit a warn via the audit logger so callers see they
 * leaked a credential into an audit call (helps catch bugs in dev).
 *
 * @param {Object} payload
 * @returns {Object} sanitized payload (never mutates input)
 */
function stripSensitive(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const sanitized = {};
  const stripped = [];
  for (const [key, value] of Object.entries(payload)) {
    if (isSensitiveKey(key)) {
      stripped.push(key);
      continue;
    }
    sanitized[key] = value;
  }
  if (stripped.length > 0) {
    auditLogger.warn('Audit event payload contained sensitive keys — stripped before emit', {
      strippedKeys: stripped
    });
  }
  return sanitized;
}

/**
 * Emit a structured audit-log entry.
 *
 * @param {string} eventName - Must be present in `AUDIT_EVENTS`
 * @param {Object} [payload] - Arbitrary metadata. Sensitive keys are stripped.
 * @throws {Error} if `eventName` is not in the allow-list
 */
function emitAuditEvent(eventName, payload = {}) {
  if (typeof eventName !== 'string' || !AUDIT_EVENTS.includes(eventName)) {
    throw new Error(`emitAuditEvent: unknown event "${eventName}" — add to AUDIT_EVENTS allow-list`);
  }
  const sanitized = stripSensitive(payload);
  auditLogger.info(eventName, {
    event: eventName,
    ...sanitized,
    timestamp: new Date().toISOString()
  });
}

module.exports = { emitAuditEvent, AUDIT_EVENTS };
