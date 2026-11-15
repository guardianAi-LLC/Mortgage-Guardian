/**
 * Auth routes — Clerk webhook receiver
 *
 * `POST /v1/auth/clerk-webhook` accepts Clerk's outbound webhook events
 * (session.created / session.ended / session.removed / session.revoked /
 * user.deleted) and emits structured audit-log entries so we have a
 * persistent record of every session lifecycle event.
 *
 * Signature verification uses Svix (Clerk's recommended verifier) against
 * the raw request body. The CLERK_WEBHOOK_SECRET env var holds the secret
 * surfaced by the Clerk Dashboard → Webhooks endpoint settings.
 *
 * This route is exempt from the CSRF Origin guard (Phase 56-01) because
 * Clerk's outbound webhook calls don't include an Origin header — they
 * authenticate via svix-signature instead.
 */

const express = require('express');
const { Webhook } = require('svix');
const { createLogger } = require('../utils/logger');
const { emitAuditEvent } = require('../utils/auditEvent');

const logger = createLogger('auth-webhook');
const router = express.Router();

/**
 * Convert the verified Clerk event into one or more audit emissions.
 * Returns true if an event type matched and was handled.
 *
 * @param {Object} event - Verified Clerk event payload
 * @param {string} requestId
 * @returns {boolean}
 */
function dispatchClerkEvent(event, requestId) {
  if (!event || typeof event.type !== 'string') return false;
  const data = event.data || {};
  switch (event.type) {
    case 'session.created':
      emitAuditEvent('session_started', {
        userId: data.user_id,
        sessionId: data.id,
        requestId
      });
      return true;
    case 'session.ended':
    case 'session.removed':
    case 'session.revoked':
      emitAuditEvent('session_ended', {
        userId: data.user_id,
        sessionId: data.id,
        reason: event.type,
        requestId
      });
      return true;
    case 'user.deleted':
      emitAuditEvent('user_deleted', {
        userId: data.id,
        requestId
      });
      return true;
    default:
      return false;
  }
}

/**
 * POST /clerk-webhook
 *
 * Uses express.raw() per-route so svix gets the unparsed body. The
 * global express.json() body parser mounted earlier in server.js parses
 * other routes normally; raw parsing only applies here.
 */
router.post(
  '/clerk-webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      logger.error('CLERK_WEBHOOK_SECRET not configured — refusing webhook');
      return res.status(503).json({ error: 'Webhook receiver not configured' });
    }

    const headers = {
      'svix-id': req.header('svix-id'),
      'svix-timestamp': req.header('svix-timestamp'),
      'svix-signature': req.header('svix-signature')
    };

    let event;
    try {
      const wh = new Webhook(secret);
      // svix accepts either a string or a Buffer; express.raw() gives us a Buffer.
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
      event = wh.verify(rawBody, headers);
    } catch (err) {
      emitAuditEvent('auth_failure', {
        reason: 'invalid_clerk_webhook_signature',
        requestId: req.requestId,
        route: req.path,
        method: req.method
      });
      logger.warn('Clerk webhook signature verification failed', { reason: err.message });
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid webhook signature' });
    }

    const handled = dispatchClerkEvent(event, req.requestId);
    if (!handled) {
      logger.info('Clerk webhook received unhandled event type', { type: event && event.type });
    }

    // Always return 200 on valid signature so Clerk doesn't retry indefinitely.
    return res.status(200).json({ received: true });
  }
);

module.exports = router;
