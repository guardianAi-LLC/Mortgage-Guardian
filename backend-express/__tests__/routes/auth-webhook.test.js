/**
 * Clerk webhook route — supertest cases
 *
 * Covers:
 *   - Invalid svix signature → 401 + auth_failure emitted with
 *     reason='invalid_clerk_webhook_signature'
 *   - Each handled event type (session.created, session.ended,
 *     session.removed, session.revoked, user.deleted) → 200 + correct
 *     audit event emitted
 *   - Unknown event type → 200, info-logged, no audit event
 *   - Webhook is mounted under /v1/auth/clerk-webhook
 */

const request = require('supertest');

// Mock svix BEFORE requiring the route so the route's `new Webhook()` uses our mock.
const mockVerify = jest.fn();
jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: mockVerify
  }))
}));

// Mock auditEvent so we can assert on emissions without touching Winston.
const mockEmitAuditEvent = jest.fn();
jest.mock('../../utils/auditEvent', () => ({
  emitAuditEvent: mockEmitAuditEvent,
  AUDIT_EVENTS: ['session_started', 'session_ended', 'user_deleted', 'auth_failure']
}));

process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_secret_value';

const express = require('express');
const authRoutes = require('../../routes/auth');

function buildApp() {
  const app = express();
  // Attach requestId for parity with production middleware
  app.use((req, _res, next) => {
    req.requestId = 'test-req-id';
    next();
  });
  app.use('/v1/auth', authRoutes);
  return app;
}

describe('POST /v1/auth/clerk-webhook', () => {
  let app;

  beforeEach(() => {
    mockVerify.mockReset();
    mockEmitAuditEvent.mockReset();
    app = buildApp();
  });

  test('returns 401 + auth_failure when svix signature verification fails', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('No matching signature found');
    });

    const res = await request(app)
      .post('/v1/auth/clerk-webhook')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_1')
      .set('svix-timestamp', '1700000000')
      .set('svix-signature', 'v1,bogus')
      .send({ type: 'session.created', data: { id: 's1', user_id: 'u1' } });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(mockEmitAuditEvent).toHaveBeenCalledWith('auth_failure', expect.objectContaining({
      reason: 'invalid_clerk_webhook_signature',
      requestId: 'test-req-id',
      method: 'POST'
    }));
  });

  test('session.created → 200 + session_started emitted', async () => {
    mockVerify.mockReturnValue({
      type: 'session.created',
      data: { id: 'sess_abc', user_id: 'user_xyz' }
    });

    const res = await request(app)
      .post('/v1/auth/clerk-webhook')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_2')
      .set('svix-timestamp', '1700000000')
      .set('svix-signature', 'v1,valid')
      .send({ type: 'session.created', data: { id: 'sess_abc', user_id: 'user_xyz' } });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockEmitAuditEvent).toHaveBeenCalledWith('session_started', expect.objectContaining({
      userId: 'user_xyz',
      sessionId: 'sess_abc',
      requestId: 'test-req-id'
    }));
  });

  test.each([
    ['session.ended'],
    ['session.removed'],
    ['session.revoked']
  ])('%s → 200 + session_ended emitted with reason=event type', async (eventType) => {
    mockVerify.mockReturnValue({
      type: eventType,
      data: { id: 'sess_end', user_id: 'user_end' }
    });

    const res = await request(app)
      .post('/v1/auth/clerk-webhook')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_3')
      .set('svix-timestamp', '1700000000')
      .set('svix-signature', 'v1,valid')
      .send({ type: eventType, data: { id: 'sess_end', user_id: 'user_end' } });

    expect(res.status).toBe(200);
    expect(mockEmitAuditEvent).toHaveBeenCalledWith('session_ended', expect.objectContaining({
      userId: 'user_end',
      sessionId: 'sess_end',
      reason: eventType,
      requestId: 'test-req-id'
    }));
  });

  test('user.deleted → 200 + user_deleted emitted', async () => {
    mockVerify.mockReturnValue({
      type: 'user.deleted',
      data: { id: 'user_to_delete' }
    });

    const res = await request(app)
      .post('/v1/auth/clerk-webhook')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_4')
      .set('svix-timestamp', '1700000000')
      .set('svix-signature', 'v1,valid')
      .send({ type: 'user.deleted', data: { id: 'user_to_delete' } });

    expect(res.status).toBe(200);
    expect(mockEmitAuditEvent).toHaveBeenCalledWith('user_deleted', expect.objectContaining({
      userId: 'user_to_delete',
      requestId: 'test-req-id'
    }));
  });

  test('unknown event type → 200, no audit event', async () => {
    mockVerify.mockReturnValue({
      type: 'organization.created',
      data: { id: 'org_1' }
    });

    const res = await request(app)
      .post('/v1/auth/clerk-webhook')
      .set('Content-Type', 'application/json')
      .set('svix-id', 'msg_5')
      .set('svix-timestamp', '1700000000')
      .set('svix-signature', 'v1,valid')
      .send({ type: 'organization.created', data: { id: 'org_1' } });

    expect(res.status).toBe(200);
    expect(mockEmitAuditEvent).not.toHaveBeenCalled();
  });
});
