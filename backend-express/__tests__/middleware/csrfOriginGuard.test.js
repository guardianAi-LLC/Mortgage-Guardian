/**
 * csrfOriginGuard Middleware Tests
 *
 * Verifies the Origin/Referer CSRF gate covers:
 *   - Safe verbs bypass (GET, OPTIONS preflight)
 *   - Bearer-token bypass (iOS / server-to-server clients)
 *   - Origin allowed → accept
 *   - Origin not allowed → 403
 *   - No Origin, no bearer → 403
 *   - Referer fallback when Origin absent
 *   - Exempt path bypass (Plaid webhook)
 */

const express = require('express');
const request = require('supertest');
const { csrfOriginGuard } = require('../../middleware/csrfOriginGuard');

function buildApp() {
    const app = express();
    app.use(express.json());
    app.use(csrfOriginGuard({
        allowedOrigins: ['https://allowed.example'],
        exemptPaths: ['/v1/plaid/webhook'],
    }));
    app.get('/test', (req, res) => res.json({ ok: true, method: 'GET' }));
    app.post('/test', (req, res) => res.json({ ok: true, method: 'POST' }));
    app.options('/test', (req, res) => res.json({ ok: true, method: 'OPTIONS' }));
    app.post('/v1/plaid/webhook', (req, res) => res.json({ ok: true, webhook: true }));
    return app;
}

describe('csrfOriginGuard middleware', () => {
    let app;

    beforeEach(() => {
        app = buildApp();
    });

    test('GET /test with no Origin → 200 (read-only bypass)', async () => {
        const res = await request(app).get('/test');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('POST /test with Authorization: Bearer and no Origin → 200 (bearer bypass)', async () => {
        const res = await request(app)
            .post('/test')
            .set('Authorization', 'Bearer abc')
            .send({});
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('POST /test with allowed Origin → 200', async () => {
        const res = await request(app)
            .post('/test')
            .set('Origin', 'https://allowed.example')
            .send({});
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('POST /test with disallowed Origin → 403 csrf_origin_mismatch', async () => {
        const res = await request(app)
            .post('/test')
            .set('Origin', 'https://evil.example')
            .send({});
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('csrf_origin_mismatch');
    });

    test('POST /test with no Origin and no bearer → 403', async () => {
        const res = await request(app)
            .post('/test')
            .send({});
        expect(res.status).toBe(403);
        expect(res.body.error).toBe('csrf_origin_mismatch');
    });

    test('POST /test with no Origin but valid Referer → 200 (Referer fallback)', async () => {
        const res = await request(app)
            .post('/test')
            .set('Referer', 'https://allowed.example/some/path')
            .send({});
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    test('POST /v1/plaid/webhook with no Origin and no bearer → 200 (exempt path)', async () => {
        const res = await request(app)
            .post('/v1/plaid/webhook')
            .send({});
        expect(res.status).toBe(200);
        expect(res.body.webhook).toBe(true);
    });

    test('OPTIONS /test with no Origin → 200 (preflight bypass)', async () => {
        const res = await request(app).options('/test');
        expect(res.status).toBe(200);
        expect(res.body.method).toBe('OPTIONS');
    });
});
