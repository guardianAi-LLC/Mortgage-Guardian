/**
 * Unit tests for the per-user Plaid resolution rate limiter (Phase 54-05).
 *
 * Uses a minimal express app so the limiter is tested in isolation from
 * auth/validation. The 'x-test-user' header stands in for the Clerk JWT —
 * the real middleware keys on req.user.id set by requireAuth.
 */

const express = require('express');
const request = require('supertest');
const { createPlaidResolveLimiter } = require('../../middleware/plaidRateLimit');

function buildApp(limiterOptions) {
  const app = express();
  // Simulate requireAuth populating req.user from the verified JWT
  app.use((req, res, next) => {
    const userId = req.headers['x-test-user'];
    if (userId) req.user = { id: userId };
    next();
  });
  app.get('/limited', createPlaidResolveLimiter(limiterOptions), (req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('createPlaidResolveLimiter', () => {
  it('allows requests up to the limit, then returns 429 with Retry-After', async () => {
    const app = buildApp({ max: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/limited').set('x-test-user', 'user-a');
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).get('/limited').set('x-test-user', 'user-a');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.body).toEqual({
      error: 'rate_limited',
      message: 'Too many Plaid requests for this user. Please try again later.'
    });
  });

  it('tracks budgets per user — one user hitting the limit does not block another', async () => {
    const app = buildApp({ max: 2, windowMs: 60_000 });

    await request(app).get('/limited').set('x-test-user', 'user-b');
    await request(app).get('/limited').set('x-test-user', 'user-b');
    const blockedB = await request(app).get('/limited').set('x-test-user', 'user-b');
    expect(blockedB.status).toBe(429);

    const freshC = await request(app).get('/limited').set('x-test-user', 'user-c');
    expect(freshC.status).toBe(200);
  });

  it('falls back to IP keying when req.user is absent', async () => {
    const app = buildApp({ max: 1, windowMs: 60_000 });

    const first = await request(app).get('/limited');
    expect(first.status).toBe(200);

    const second = await request(app).get('/limited');
    expect(second.status).toBe(429);
  });

  it('reads limits from env vars when no options are passed', async () => {
    const prevMax = process.env.PLAID_RESOLVE_RATE_LIMIT_MAX;
    const prevWindow = process.env.PLAID_RESOLVE_RATE_LIMIT_WINDOW_MS;
    process.env.PLAID_RESOLVE_RATE_LIMIT_MAX = '1';
    process.env.PLAID_RESOLVE_RATE_LIMIT_WINDOW_MS = '60000';

    try {
      const app = buildApp();

      const first = await request(app).get('/limited').set('x-test-user', 'user-env');
      expect(first.status).toBe(200);

      const second = await request(app).get('/limited').set('x-test-user', 'user-env');
      expect(second.status).toBe(429);
    } finally {
      if (prevMax === undefined) delete process.env.PLAID_RESOLVE_RATE_LIMIT_MAX;
      else process.env.PLAID_RESOLVE_RATE_LIMIT_MAX = prevMax;
      if (prevWindow === undefined) delete process.env.PLAID_RESOLVE_RATE_LIMIT_WINDOW_MS;
      else process.env.PLAID_RESOLVE_RATE_LIMIT_WINDOW_MS = prevWindow;
    }
  });
});
