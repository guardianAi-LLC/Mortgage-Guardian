/**
 * Plaid Token Encryption Service
 *
 * Per-user encryption of Plaid access tokens using AES-256-GCM with
 * HKDF-SHA256 key derivation. Each user gets a unique encryption key
 * derived from a master key + userId, providing cryptographic tenant
 * isolation for token storage.
 *
 * Pack format: iv(12) + authTag(16) + ciphertext(N) in a single Buffer.
 *
 * Mirrors the structure of `documentEncryptionService.js` but uses a
 * SEPARATE master key (PLAID_ENCRYPTION_KEY) so compromise of one
 * subsystem does not force rotation of the other.
 *
 * Dependencies: Node.js crypto module only (zero external dependencies).
 */

const crypto = require('crypto');
const { createLogger } = require('../utils/logger');

const logger = createLogger('plaid-token-encryption');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const HKDF_INFO = 'mortgage-guardian-plaid-token-v1';

class PlaidTokenEncryptionService {
  constructor() {
    const hexKey = process.env.PLAID_ENCRYPTION_KEY;
    if (!hexKey) {
      throw new Error(
        'PLAID_ENCRYPTION_KEY environment variable is required. ' +
        'Set it to a 64-character hex string (32 bytes).'
      );
    }
    this.masterKey = Buffer.from(hexKey, 'hex');
    if (this.masterKey.length !== KEY_LENGTH) {
      throw new Error(
        `PLAID_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars), got ${this.masterKey.length} bytes.`
      );
    }
    logger.debug('Plaid token encryption service initialized');
  }

  /**
   * Derive a per-user encryption key from the master key using HKDF-SHA256.
   *
   * Info string is namespaced (`plaid-token:${userId}`) so the same userId
   * cannot produce a colliding key with another subsystem that uses HKDF
   * against the same master key — a defense-in-depth measure even though
   * Plaid uses a separate master key by design.
   *
   * @param {string} userId - The user ID used as salt for key derivation
   * @returns {Buffer} 32-byte derived key
   */
  deriveKey(userId) {
    const derived = crypto.hkdfSync(
      'sha256',
      this.masterKey,
      `plaid-token:${userId}`,
      HKDF_INFO,
      KEY_LENGTH
    );
    return Buffer.from(derived);
  }

  /**
   * Encrypt a plaintext string for a specific user.
   *
   * @param {string} userId - The user ID for key derivation
   * @param {string} plaintextString - The token to encrypt
   * @returns {Buffer} Packed buffer: iv(12) + authTag(16) + ciphertext(N)
   */
  encrypt(userId, plaintextString) {
    if (typeof plaintextString !== 'string') {
      throw new Error('plaintextString must be a string');
    }
    const key = this.deriveKey(userId);
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintextString, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();

    logger.debug('Plaid token encrypted', {
      userId,
      inputLength: plaintextString.length,
      outputLength: IV_LENGTH + AUTH_TAG_LENGTH + ciphertext.length
    });

    return Buffer.concat([iv, authTag, ciphertext]);
  }

  /**
   * Decrypt a packed encrypted buffer for a specific user.
   *
   * @param {string} userId - The user ID for key derivation
   * @param {Buffer} encryptedBuffer - Packed buffer: iv(12) + authTag(16) + ciphertext(N)
   * @returns {string} Decrypted plaintext token
   * @throws {Error} If authentication fails (tampered data or wrong key)
   */
  decrypt(userId, encryptedBuffer) {
    const key = this.deriveKey(userId);

    const iv = encryptedBuffer.subarray(0, IV_LENGTH);
    const authTag = encryptedBuffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedBuffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]).toString('utf8');

    logger.debug('Plaid token decrypted', {
      userId,
      inputLength: encryptedBuffer.length,
      outputLength: plaintext.length
    });

    return plaintext;
  }

  /**
   * Encrypt a token and return a base64 string suitable for storing
   * in a TEXT column (no BYTEA serialization concerns through PostgREST).
   *
   * @param {string} userId
   * @param {string} token
   * @returns {string} base64-encoded packed ciphertext
   */
  encryptForStorage(userId, token) {
    return this.encrypt(userId, token).toString('base64');
  }

  /**
   * Decrypt a base64-encoded packed ciphertext from storage.
   *
   * @param {string} userId
   * @param {string} b64
   * @returns {string} decrypted token
   */
  decryptFromStorage(userId, b64) {
    const buf = Buffer.from(b64, 'base64');
    return this.decrypt(userId, buf);
  }
}

module.exports = new PlaidTokenEncryptionService();
