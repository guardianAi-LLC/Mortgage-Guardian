/**
 * Plaid Token Encryption Service Tests (Phase 54-01)
 *
 * Mirrors documentEncryptionService.test.js but uses a separate master
 * key (PLAID_ENCRYPTION_KEY) and string-typed plaintext (tokens).
 */

const crypto = require('crypto');

const TEST_MASTER_KEY = crypto.randomBytes(32).toString('hex');

beforeAll(() => {
  process.env.PLAID_ENCRYPTION_KEY = TEST_MASTER_KEY;
});

afterAll(() => {
  delete process.env.PLAID_ENCRYPTION_KEY;
});

let service;
function getService() {
  if (!service) {
    service = require('../../services/plaidTokenEncryptionService');
  }
  return service;
}

describe('PlaidTokenEncryptionService', () => {
  const userId = 'user-abc-123';
  const otherUserId = 'user-xyz-789';
  const token = 'access-sandbox-7f1a4b2e-1234-5678-9abc-def012345678';

  test('round-trip preserves plaintext', () => {
    const s = getService();
    const packed = s.encryptForStorage(userId, token);
    expect(s.decryptFromStorage(userId, packed)).toBe(token);
  });

  test('cross-user decrypt throws (HKDF info mismatch)', () => {
    const s = getService();
    const packed = s.encryptForStorage(userId, token);
    expect(() => s.decryptFromStorage(otherUserId, packed)).toThrow();
  });

  test('tampered ciphertext throws (auth tag mismatch)', () => {
    const s = getService();
    const packedB64 = s.encryptForStorage(userId, token);
    const buf = Buffer.from(packedB64, 'base64');
    // Flip a byte in the ciphertext portion (after iv[12] + tag[16] = 28)
    buf[28] ^= 0xff;
    const tampered = buf.toString('base64');
    expect(() => s.decryptFromStorage(userId, tampered)).toThrow();
  });

  test('encrypting same plaintext twice yields different ciphertexts (random IV)', () => {
    const s = getService();
    const c1 = s.encryptForStorage(userId, token);
    const c2 = s.encryptForStorage(userId, token);
    expect(c1).not.toBe(c2);
    // Both must still decrypt to the same value
    expect(s.decryptFromStorage(userId, c1)).toBe(token);
    expect(s.decryptFromStorage(userId, c2)).toBe(token);
  });
});
