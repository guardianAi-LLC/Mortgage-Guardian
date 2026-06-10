/**
 * Plaid Sandbox Round-Trip Integration Test (M001/S03/T04)
 *
 * Closes the S03 contract by exercising the full chain end-to-end against
 * the REAL Plaid sandbox API:
 *
 *   POST /v1/plaid/sandbox_public_token   →  public-sandbox-...
 *   POST /v1/plaid/exchange_token         →  access-sandbox-... (persisted under JWT user)
 *   POST /v1/plaid/transactions           →  ≥1 transaction
 *   GET  /v1/plaid/items                  →  item appears for the JWT user
 *
 * What is mocked:
 *   - @supabase/supabase-js   → provides req.user.id = 'mock-user-id-12345'
 *                               (T02 identity-trust pattern — MEM026)
 *   - plaidDataService        → in-memory store (no real Supabase needed)
 *
 * What is REAL:
 *   - plaidService            → hits the actual Plaid sandbox HTTP API.
 *                               Requires PLAID_CLIENT_ID/SECRET in .env (T01 gate).
 *
 * Skip behavior: if PLAID_CLIENT_ID is unset/'mock', the test logs a clear skip
 * line and exits 0 — CI without sandbox creds does not false-fail. T01's
 * smoke-plaid-startup.sh is the gate that ensures real creds in the local run.
 */

// Load .env BEFORE we read process.env for the skip gate. server.js also calls
// dotenv.config() at require-time, but the skip gate runs first.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const request = require('supertest');
const { createMockSupabaseClient } = require('../mocks/mockSupabaseClient');

// ----------------------------------------------------------------------------
// Skip gate: real Plaid sandbox creds required for this test to be meaningful.
// ----------------------------------------------------------------------------
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const HAS_REAL_PLAID =
  PLAID_CLIENT_ID &&
  PLAID_CLIENT_ID !== 'mock' &&
  !PLAID_CLIENT_ID.startsWith('mock') &&
  process.env.PLAID_SECRET &&
  process.env.PLAID_ENV === 'sandbox';

if (!HAS_REAL_PLAID) {
  // eslint-disable-next-line no-console
  console.log(
    '[plaid-sandbox-roundtrip] SKIP: real Plaid sandbox creds missing ' +
    `(PLAID_CLIENT_ID=${PLAID_CLIENT_ID ? '<set>' : '<unset>'}, ` +
    `PLAID_SECRET=${process.env.PLAID_SECRET ? '<set>' : '<unset>'}, ` +
    `PLAID_ENV=${process.env.PLAID_ENV || '<unset>'}). ` +
    'Run T01 smoke-plaid-startup.sh first to verify creds. Skipping.'
  );
}

// ----------------------------------------------------------------------------
// Mocks — must be hoisted before requiring the server.
// ----------------------------------------------------------------------------
const mockClient = createMockSupabaseClient();
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockClient)
}));

// Per-user in-memory item store so /items reflects /exchange_token writes.
// This is the canonical T02 identity-trust contract: we record what userId
// the route handler tried to write under, then assert it matches req.user.id.
const upsertedItems = []; // { itemId, userId, accessToken, status, institutionId }
const mockUpsertPlaidItem = jest.fn(async (payload) => {
  upsertedItems.push({ ...payload });
  return { success: true };
});
const mockGetItemsForUser = jest.fn(async (userId) => {
  const items = upsertedItems
    .filter((i) => i.userId === userId)
    .map((i) => ({
      itemId: i.itemId,
      institutionId: i.institutionId,
      status: i.status,
      updatedAt: new Date().toISOString(),
      accounts: []
    }));
  return { success: true, items };
});

// Phase 54: routes resolve the access token server-side from item_id.
const mockResolveTokenByItemId = jest.fn(async (userId, itemId) => {
  const item = upsertedItems.find((i) => i.userId === userId && i.itemId === itemId);
  if (!item) return { success: false, error: 'item_not_found' };
  return { success: true, accessToken: item.accessToken };
});

jest.mock('../../services/plaidDataService', () => ({
  upsertPlaidItem: (...args) => mockUpsertPlaidItem(...args),
  resolveTokenByItemId: (...args) => mockResolveTokenByItemId(...args),
  getItem: jest.fn().mockResolvedValue({ success: true, data: null }),
  getItemsForUser: (...args) => mockGetItemsForUser(...args),
  storeTransactions: jest.fn().mockResolvedValue({ success: true }),
  upsertAccounts: jest.fn().mockResolvedValue({ success: true }),
  createNotification: jest.fn().mockResolvedValue({ success: true }),
  removeTransactions: jest.fn().mockResolvedValue({ success: true }),
  updateItemStatus: jest.fn().mockResolvedValue({ success: true })
}));

// Required env so server.js loads cleanly under VERCEL=1 path
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://mock.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'mock-anon-key';
process.env.NODE_ENV = 'production';
process.env.VERCEL = '1';

const AUTH = 'Bearer valid-token'; // Mock supabase getUser returns mock-user-id-12345

let app;

// Force fresh module loads so the mocks above bind, then read the server.
beforeAll(() => {
  const serverPath = require.resolve('../../server');
  const routePaths = [
    require.resolve('../../routes/plaid'),
    require.resolve('../../routes/health')
  ];
  delete require.cache[serverPath];
  for (const routePath of routePaths) {
    delete require.cache[routePath];
  }
  delete require.cache[require.resolve('../../middleware/auth')];

  app = require('../../server');
  process.env.NODE_ENV = 'test';
});

afterAll(() => {
  delete process.env.VERCEL;
});

// ----------------------------------------------------------------------------
// The conditional describe is the skip gate.
// ----------------------------------------------------------------------------
const describeIfPlaid = HAS_REAL_PLAID ? describe : describe.skip;

describeIfPlaid('Plaid sandbox round-trip (real Plaid API)', () => {
  // Plaid sandbox calls can take a few seconds each; budget generously.
  jest.setTimeout(60_000);

  const EXPECTED_USER_ID = 'mock-user-id-12345';

  let publicToken;
  let accessToken;
  let itemId;

  it('POST /v1/plaid/sandbox_public_token returns a real public-sandbox token', async () => {
    const res = await request(app)
      .post('/v1/plaid/sandbox_public_token')
      .set('Authorization', AUTH)
      .send({
        institution_id: 'ins_109508',
        initial_products: ['transactions']
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.public_token).toBe('string');
    expect(res.body.public_token).toMatch(/^public-sandbox-/);

    publicToken = res.body.public_token;
  });

  it('POST /v1/plaid/exchange_token returns access-sandbox token AND persists under req.user.id', async () => {
    expect(publicToken).toBeDefined();

    const res = await request(app)
      .post('/v1/plaid/exchange_token')
      .set('Authorization', AUTH)
      .send({
        public_token: publicToken,
        // Body user_id is intentionally an attacker value — handler MUST ignore (MEM026).
        user_id: 'attacker-supplied-user-id',
        institution_id: 'ins_109508'
      });

    expect(res.status).toBe(200);
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.access_token).toMatch(/^access-sandbox-/);
    expect(typeof res.body.item_id).toBe('string');

    accessToken = res.body.access_token;
    itemId = res.body.item_id;

    // Identity-trust contract: persisted user MUST be the JWT-derived user,
    // not the body-supplied attacker value.
    expect(mockUpsertPlaidItem).toHaveBeenCalledTimes(1);
    const persistedPayload = mockUpsertPlaidItem.mock.calls[0][0];
    expect(persistedPayload.userId).toBe(EXPECTED_USER_ID);
    expect(persistedPayload.userId).not.toBe('attacker-supplied-user-id');
    expect(persistedPayload.itemId).toBe(itemId);
    expect(persistedPayload.accessToken).toBe(accessToken);
    expect(persistedPayload.institutionId).toBe('ins_109508');
  });

  it('POST /v1/plaid/transactions returns at least one sandbox transaction', async () => {
    expect(itemId).toBeDefined();

    // Plaid sandbox seeds canned historical transactions for ins_109508, but
    // they are not immediately available after itemPublicTokenExchange — Plaid
    // returns PRODUCT_NOT_READY (HTTP 400, type ITEM_ERROR) for the first ~5s
    // until transaction data finishes initializing. The recommended pattern
    // (Plaid docs: "Testing transactions") is to either provide a webhook or
    // poll. We poll: up to 30s of 2s retries — generous enough for a slow
    // sandbox, fast enough that a real outage fails in well under our 60s
    // jest timeout.
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().slice(0, 10);

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    let res;
    let lastError;
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      res = await request(app)
        .post('/v1/plaid/transactions')
        .set('Authorization', AUTH)
        .send({
          item_id: itemId,
          start_date: fmt(thirtyDaysAgo),
          end_date: fmt(today),
          count: 50
        });

      if (res.status === 200) break;
      // PRODUCT_NOT_READY surfaces as HTTP 400 with type:'ITEM_ERROR',
      // code:'PRODUCT_NOT_READY' from the route's error path. Anything else
      // (5xx, auth error, schema error) is a real failure — surface it now.
      lastError = res.body;
      const isProductNotReady =
        res.status === 400 &&
        (res.body?.code === 'PRODUCT_NOT_READY' ||
          /not.*ready/i.test(res.body?.error || res.body?.message || ''));
      if (!isProductNotReady) break;
      await sleep(2000);
    }

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
    // Plaid sandbox returns synthetic transactions; the contract is "≥1".
    expect(res.body.transactions.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.accounts)).toBe(true);
    // Reference lastError to avoid unused-var lint when the first try succeeds.
    void lastError;
  });

  it('GET /v1/plaid/items returns the item we just exchanged, scoped to the JWT user', async () => {
    expect(itemId).toBeDefined();

    const res = await request(app)
      .get('/v1/plaid/items')
      .set('Authorization', AUTH);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);

    const ours = res.body.items.find((i) => i.itemId === itemId);
    expect(ours).toBeDefined();
    expect(ours.institutionId).toBe('ins_109508');
    expect(ours.status).toBe('active');

    // Belt-and-suspenders: confirm the data layer was queried with req.user.id,
    // not any body or query value.
    expect(mockGetItemsForUser).toHaveBeenCalledWith(EXPECTED_USER_ID);
  });
});
