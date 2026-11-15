/**
 * auditEvent helper — unit tests
 *
 * Covers:
 *   - Allow-list rejection (unknown event throws)
 *   - Sensitive-key stripping (token / password / secret / apiKey / access_token)
 *   - Preserves legitimate identifiers (sessionId, userId, itemId)
 *   - Timestamp + event-name injection on every emit
 *   - Empty / non-object payload tolerated
 */

// Mock logger before requiring the module under test so the child logger
// returned to auditEvent.js is our spy.
const mockInfo = jest.fn();
const mockWarn = jest.fn();
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: mockInfo,
    warn: mockWarn,
    debug: jest.fn(),
    error: jest.fn()
  }))
}));

const { emitAuditEvent, AUDIT_EVENTS } = require('../../utils/auditEvent');

describe('auditEvent.emitAuditEvent', () => {
  beforeEach(() => {
    mockInfo.mockClear();
    mockWarn.mockClear();
  });

  test('AUDIT_EVENTS allow-list is frozen and contains required events', () => {
    expect(Object.isFrozen(AUDIT_EVENTS)).toBe(true);
    expect(AUDIT_EVENTS).toEqual(expect.arrayContaining([
      'session_started',
      'session_ended',
      'user_deleted',
      'auth_failure',
      'plaid_token_decrypted',
      'plaid_token_encrypted',
      'plaid_key_rotated'
    ]));
  });

  test('throws on unknown event name', () => {
    expect(() => emitAuditEvent('not_a_real_event', {})).toThrow(/unknown event/i);
    expect(mockInfo).not.toHaveBeenCalled();
  });

  test('throws on non-string event name', () => {
    expect(() => emitAuditEvent(null, {})).toThrow();
    expect(() => emitAuditEvent(undefined, {})).toThrow();
    expect(() => emitAuditEvent(42, {})).toThrow();
  });

  test('emits with event name, timestamp, and payload', () => {
    emitAuditEvent('auth_failure', {
      reason: 'missing_token',
      requestId: 'req-123',
      route: '/v1/plaid/accounts',
      method: 'GET'
    });
    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [name, meta] = mockInfo.mock.calls[0];
    expect(name).toBe('auth_failure');
    expect(meta.event).toBe('auth_failure');
    expect(meta.reason).toBe('missing_token');
    expect(meta.requestId).toBe('req-123');
    expect(meta.route).toBe('/v1/plaid/accounts');
    expect(meta.method).toBe('GET');
    expect(typeof meta.timestamp).toBe('string');
    expect(meta.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('strips sensitive keys before logging', () => {
    emitAuditEvent('session_started', {
      userId: 'user_123',
      sessionId: 'sess_abc',
      itemId: 'item_xyz',
      token: 'eyJhbGciOi...secret',
      access_token: 'public-asdf',
      accessToken: 'asdf-token',
      password: 'hunter2',
      clientSecret: 'shh',
      apiKey: 'sk_live_xxx',
      bearerToken: 'oops'
    });
    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [, meta] = mockInfo.mock.calls[0];
    // Stripped
    expect(meta.token).toBeUndefined();
    expect(meta.access_token).toBeUndefined();
    expect(meta.accessToken).toBeUndefined();
    expect(meta.password).toBeUndefined();
    expect(meta.clientSecret).toBeUndefined();
    expect(meta.apiKey).toBeUndefined();
    expect(meta.bearerToken).toBeUndefined();
    // Preserved
    expect(meta.userId).toBe('user_123');
    expect(meta.sessionId).toBe('sess_abc');
    expect(meta.itemId).toBe('item_xyz');
    // Warning emitted about stripping
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const [, warnMeta] = mockWarn.mock.calls[0];
    expect(warnMeta.strippedKeys).toEqual(
      expect.arrayContaining(['token', 'access_token', 'accessToken', 'password', 'clientSecret', 'apiKey', 'bearerToken'])
    );
  });

  test('case-insensitive sensitive-key matching', () => {
    emitAuditEvent('user_deleted', {
      userId: 'u1',
      TOKEN: 'abc',
      Password: 'p',
      API_KEY: 'k' // does not match (API_KEY isn't 'apikey'); but APIKEY would
    });
    const [, meta] = mockInfo.mock.calls[0];
    expect(meta.TOKEN).toBeUndefined();
    expect(meta.Password).toBeUndefined();
    expect(meta.userId).toBe('u1');
  });

  test('handles empty / undefined payload', () => {
    emitAuditEvent('user_deleted');
    expect(mockInfo).toHaveBeenCalledTimes(1);
    const [name, meta] = mockInfo.mock.calls[0];
    expect(name).toBe('user_deleted');
    expect(meta.event).toBe('user_deleted');
    expect(typeof meta.timestamp).toBe('string');
  });

  test('does not mutate caller payload', () => {
    const payload = { userId: 'u1', token: 'leak' };
    emitAuditEvent('session_started', payload);
    expect(payload.token).toBe('leak'); // original kept intact
  });
});
