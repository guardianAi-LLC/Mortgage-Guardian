#!/usr/bin/env node
/**
 * Phase 54-04 — Plaid token backfill.
 *
 * Encrypts every legacy plaintext `plaid_items.access_token` row using the
 * per-user encryption service, then nulls out the plaintext column. Idempotent:
 * the WHERE filter (`access_token IS NOT NULL`) empties after a successful
 * apply, so re-running is a no-op.
 *
 *   node scripts/backfill-plaid-tokens.js              # dry-run (default)
 *   node scripts/backfill-plaid-tokens.js --apply      # write changes
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_KEY (NEVER the anon key) and
 * PLAID_ENCRYPTION_KEY in the env. Exit code is 0 only when zero mismatches
 * and zero errors occurred; CI/runbooks can rely on the exit code.
 *
 * Logs only counts, itemIds, and userIds — never token material.
 */

const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const tokenEnc = require('../services/plaidTokenEncryptionService');

const APPLY = process.argv.includes('--apply');

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(2);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  fail('SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');
}
if (!process.env.PLAID_ENCRYPTION_KEY) {
  fail('PLAID_ENCRYPTION_KEY is required.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const report = {
  mode: APPLY ? 'apply' : 'dry-run',
  total: 0,
  alreadyEncryptedVerified: 0,
  newlyEncrypted: 0,
  mismatches: 0,
  errors: 0,
  plaintextNulledOut: 0
};

async function fetchLegacyRows() {
  const { data, error } = await supabase
    .from('plaid_items')
    .select('item_id, user_id, access_token, access_token_encrypted, encryption_version')
    .not('access_token', 'is', null);

  if (error) {
    fail(`Failed to query plaid_items: ${error.message}`);
  }
  return data || [];
}

async function writeEncrypted(itemId, encryptedB64) {
  if (!APPLY) return { success: true };
  const { error } = await supabase
    .from('plaid_items')
    .update({
      access_token_encrypted: encryptedB64,
      encryption_version: 1,
      updated_at: new Date().toISOString()
    })
    .eq('item_id', itemId);
  return { success: !error, error: error?.message };
}

async function nullPlaintext(itemId) {
  if (!APPLY) return { success: true };
  const { error } = await supabase
    .from('plaid_items')
    .update({
      access_token: null,
      updated_at: new Date().toISOString()
    })
    .eq('item_id', itemId);
  return { success: !error, error: error?.message };
}

async function processRow(row) {
  const { item_id: itemId, user_id: userId, access_token: plaintext, access_token_encrypted: encrypted } = row;

  if (!userId) {
    console.error(`SKIP: itemId=${itemId} has no user_id`);
    report.errors += 1;
    return;
  }

  // Case A: already encrypted — verify the ciphertext decrypts to the same
  // plaintext before nulling. A mismatch is an integrity alarm, not something
  // to paper over.
  if (encrypted) {
    let decoded;
    try {
      decoded = tokenEnc.decryptFromStorage(userId, encrypted);
    } catch (err) {
      console.error(`MISMATCH: itemId=${itemId} userId=${userId} — decrypt failed: ${err.message}`);
      report.mismatches += 1;
      return;
    }
    if (decoded !== plaintext) {
      console.error(`MISMATCH: itemId=${itemId} userId=${userId} — ciphertext does not match plaintext`);
      report.mismatches += 1;
      return;
    }
    report.alreadyEncryptedVerified += 1;
    const nullRes = await nullPlaintext(itemId);
    if (!nullRes.success) {
      console.error(`ERROR: itemId=${itemId} null-out failed: ${nullRes.error}`);
      report.errors += 1;
      return;
    }
    report.plaintextNulledOut += 1;
    console.log(`OK ${APPLY ? 'nulled' : 'would null'}: itemId=${itemId} (verified existing ciphertext)`);
    return;
  }

  // Case B: plaintext only — encrypt, write, then null plaintext.
  let encryptedB64;
  try {
    encryptedB64 = tokenEnc.encryptForStorage(userId, plaintext);
  } catch (err) {
    console.error(`ERROR: itemId=${itemId} userId=${userId} encrypt failed: ${err.message}`);
    report.errors += 1;
    return;
  }

  const writeRes = await writeEncrypted(itemId, encryptedB64);
  if (!writeRes.success) {
    console.error(`ERROR: itemId=${itemId} write encrypted failed: ${writeRes.error}`);
    report.errors += 1;
    return;
  }
  report.newlyEncrypted += 1;

  const nullRes = await nullPlaintext(itemId);
  if (!nullRes.success) {
    console.error(`ERROR: itemId=${itemId} null-out failed (encrypted column already written): ${nullRes.error}`);
    report.errors += 1;
    return;
  }
  report.plaintextNulledOut += 1;
  console.log(`OK ${APPLY ? 'encrypted+nulled' : 'would encrypt+null'}: itemId=${itemId}`);
}

(async () => {
  console.log(`Backfill mode: ${report.mode}`);
  console.log('Fetching plaid_items where access_token IS NOT NULL …');

  const rows = await fetchLegacyRows();
  report.total = rows.length;
  console.log(`Found ${rows.length} legacy rows.`);

  for (const row of rows) {
    await processRow(row);
  }

  console.log('---- BACKFILL REPORT ----');
  console.log(JSON.stringify(report, null, 2));

  const cleanRun = report.mismatches === 0 && report.errors === 0;
  process.exit(cleanRun ? 0 : 1);
})().catch((err) => {
  console.error(`FATAL: ${err.message}`);
  process.exit(2);
});
