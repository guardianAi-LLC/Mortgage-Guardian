-- =============================================
-- Plaid Access Token Encryption (Phase 54-01)
-- =============================================
-- Run this migration in Supabase SQL editor
-- Created: 2026-06-07
--
-- Purpose:
--   Add columns to store AES-256-GCM encrypted Plaid access tokens
--   alongside the existing plaintext column. Tokens are encrypted via
--   plaidTokenEncryptionService (HKDF-SHA256 per-user keys, packed as
--   iv|authTag|ciphertext, base64-encoded for TEXT-column storage).
--
-- This migration is INTENTIONALLY ADDITIVE:
--   - It DOES NOT drop or rename the existing `access_token` column.
--   - During Phase 54-01..54-03, the application dual-writes plaintext
--     and ciphertext so reads can fall back if ciphertext is missing.
--   - Phase 54-04 backfills any rows still missing ciphertext.
--   - Phase 54-05 (migration 008) drops the plaintext column once
--     backfill is verified complete (encryption_version = 1 for all
--     rows and ciphertext is non-null).
--
-- Affects: plaid_items only. plaid_accounts and plaid_transactions
-- do not hold tokens and are untouched.
-- =============================================

-- 1. Add encrypted-token column (base64 of iv|authTag|ciphertext).
ALTER TABLE plaid_items
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;

-- 2. Track encryption schema version. Version 1 = AES-256-GCM with
--    HKDF-SHA256 per-user key derivation using PLAID_ENCRYPTION_KEY.
--    Future rotations bump this value so the backfill script in 54-04
--    can identify rows still on a prior version.
ALTER TABLE plaid_items
  ADD COLUMN IF NOT EXISTS encryption_version SMALLINT NOT NULL DEFAULT 1;

-- 3. Allow plaintext access_token to be NULL so new inserts (after the
--    plaintext write is removed in 54-04) do not violate NOT NULL.
--    Existing rows are preserved.
ALTER TABLE plaid_items
  ALTER COLUMN access_token DROP NOT NULL;

-- 4. Index used by the backfill script in Phase 54-04 to efficiently
--    find rows that need re-encryption (e.g. version < current).
CREATE INDEX IF NOT EXISTS idx_plaid_items_encryption_version
  ON plaid_items(encryption_version);

-- =============================================
-- Migration Notes:
-- =============================================
-- 1. Run this in Supabase SQL editor (supabase.com -> SQL Editor).
-- 2. Verify columns via `\d plaid_items` (or Table Editor):
--      - access_token (TEXT, nullable)
--      - access_token_encrypted (TEXT, nullable)
--      - encryption_version (SMALLINT, NOT NULL, default 1)
-- 3. No data loss: existing rows keep their plaintext access_token;
--    encryption_version defaults to 1; access_token_encrypted is NULL
--    until the 54-04 backfill or a fresh exchange writes it.
-- 4. Reversible: drop the two new columns and re-impose NOT NULL on
--    access_token if rollback is required (no data is lost during this
--    plan because plaintext continues to be written).
-- 5. The plaintext access_token column will be DROPPED in migration
--    008 (Phase 54-05) after backfill completes.
-- =============================================
