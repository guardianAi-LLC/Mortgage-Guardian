const { createClient } = require('@supabase/supabase-js');
const { createLogger } = require('../utils/logger');
const logger = createLogger('plaid-data');
// Phase 54-05: every successful token decryption emits a structured audit
// event ('plaid_token_decrypted'). Token material is NEVER logged.
const auditLogger = createLogger('audit');

// Lazy-load the encryption service so a missing PLAID_ENCRYPTION_KEY fails
// at first use (with a clear log) instead of crashing module load. Since
// Phase 54-05 the plaintext column is gone, so token storage and resolution
// FAIL CLOSED when the encryption service is unavailable.
let _tokenEncryption = null;
function getTokenEncryption() {
  if (_tokenEncryption !== null) return _tokenEncryption;
  try {
    _tokenEncryption = require('./plaidTokenEncryptionService');
  } catch (err) {
    logger.error('plaidTokenEncryptionService unavailable - Plaid token storage/resolution will fail closed', { error: err.message });
    _tokenEncryption = false; // sentinel: tried and failed
  }
  return _tokenEncryption;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  logger.info('Supabase client initialized for Plaid data');
} else {
  logger.warn('Supabase not configured - Plaid data will use in-memory storage');
}

class PlaidDataService {
  constructor() {
    // In-memory storage for mock/development mode
    this.mockItems = new Map();
    this.mockTransactions = new Map();
    this.mockAccounts = new Map();
  }

  /**
   * Store or update a Plaid item in the database
   */
  async upsertPlaidItem({ itemId, userId, accessToken, status, institutionId, error }) {
    if (!supabase) {
      return this.mockUpsertItem({ itemId, userId, accessToken, status, institutionId, error });
    }

    try {
      // Phase 54-05: the plaintext access_token column is dropped (migration
      // 008). The encrypted column is the sole storage for tokens, so the
      // write FAILS CLOSED if encryption is unavailable — storing nothing is
      // safer than storing a token we could never have protected.
      let accessTokenEncrypted = null;
      const encryptionVersion = 1;
      if (accessToken && userId) {
        const tokenEnc = getTokenEncryption();
        if (!tokenEnc) {
          logger.error('Cannot store Plaid access token - encryption service unavailable', { itemId });
          return { success: false, error: 'Token encryption unavailable - PLAID_ENCRYPTION_KEY required' };
        }
        try {
          accessTokenEncrypted = tokenEnc.encryptForStorage(userId, accessToken);
        } catch (encErr) {
          logger.error('Failed to encrypt Plaid access token - refusing to store item', {
            error: encErr.message,
            itemId
          });
          return { success: false, error: 'Token encryption failed' };
        }
      }

      const { data, error: dbError } = await supabase
        .from('plaid_items')
        .upsert({
          item_id: itemId,
          user_id: userId,
          access_token_encrypted: accessTokenEncrypted,
          encryption_version: encryptionVersion,
          status: status || 'active',
          institution_id: institutionId,
          error: error ? JSON.stringify(error) : null,
          last_webhook_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'item_id'
        });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Error upserting Plaid item', { error: error.message, itemId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Store transactions from Plaid webhook
   */
  async storeTransactions({ itemId, transactions, userId }) {
    if (!supabase) {
      return this.mockStoreTransactions({ itemId, transactions, userId });
    }

    try {
      // Prepare transactions for bulk insert
      const transactionRecords = transactions.map(transaction => ({
        transaction_id: transaction.transaction_id,
        item_id: itemId,
        user_id: userId,
        account_id: transaction.account_id,
        amount: transaction.amount,
        iso_currency_code: transaction.iso_currency_code,
        unofficial_currency_code: transaction.unofficial_currency_code,
        category: transaction.category ? JSON.stringify(transaction.category) : null,
        category_id: transaction.category_id,
        transaction_type: transaction.transaction_type,
        name: transaction.name,
        merchant_name: transaction.merchant_name,
        date: transaction.date,
        authorized_date: transaction.authorized_date,
        authorized_datetime: transaction.authorized_datetime,
        datetime: transaction.datetime,
        payment_channel: transaction.payment_channel,
        location: transaction.location ? JSON.stringify(transaction.location) : null,
        payment_meta: transaction.payment_meta ? JSON.stringify(transaction.payment_meta) : null,
        account_owner: transaction.account_owner,
        pending: transaction.pending,
        pending_transaction_id: transaction.pending_transaction_id,
        transaction_code: transaction.transaction_code,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('plaid_transactions')
        .upsert(transactionRecords, {
          onConflict: 'transaction_id'
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Transactions stored', { count: transactions.length, itemId });
      return { success: true, count: transactions.length, data };
    } catch (error) {
      logger.error('Error storing transactions', { error: error.message, itemId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove transactions from database
   */
  async removeTransactions({ transactionIds }) {
    if (!supabase) {
      return this.mockRemoveTransactions({ transactionIds });
    }

    try {
      const { data, error } = await supabase
        .from('plaid_transactions')
        .delete()
        .in('transaction_id', transactionIds);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Transactions removed', { count: transactionIds.length });
      return { success: true, count: transactionIds.length, data };
    } catch (error) {
      logger.error('Error removing transactions', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update item status (for errors, warnings, etc.)
   */
  async updateItemStatus({ itemId, status, error = null, requiresAction = false }) {
    if (!supabase) {
      return this.mockUpdateItemStatus({ itemId, status, error, requiresAction });
    }

    try {
      const updateData = {
        status,
        error: error ? JSON.stringify(error) : null,
        requires_user_action: requiresAction,
        updated_at: new Date().toISOString()
      };

      const { data, error: dbError } = await supabase
        .from('plaid_items')
        .update(updateData)
        .eq('item_id', itemId);

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      logger.info('Item status updated', { itemId, status });
      return { success: true, data };
    } catch (error) {
      logger.error('Error updating item status', { error: error.message, itemId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Store or update accounts information
   */
  async upsertAccounts({ itemId, accounts, userId }) {
    if (!supabase) {
      return this.mockUpsertAccounts({ itemId, accounts, userId });
    }

    try {
      const accountRecords = accounts.map(account => ({
        account_id: account.account_id,
        item_id: itemId,
        user_id: userId,
        name: account.name,
        official_name: account.official_name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        current_balance: account.balances?.current,
        available_balance: account.balances?.available,
        limit: account.balances?.limit,
        iso_currency_code: account.balances?.iso_currency_code,
        unofficial_currency_code: account.balances?.unofficial_currency_code,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('plaid_accounts')
        .upsert(accountRecords, {
          onConflict: 'account_id'
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Accounts updated', { count: accounts.length, itemId });
      return { success: true, count: accounts.length, data };
    } catch (error) {
      logger.error('Error upserting accounts', { error: error.message, itemId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Get item by ID
   */
  async getItem(itemId) {
    if (!supabase) {
      return this.mockGetItem(itemId);
    }

    try {
      const { data, error } = await supabase
        .from('plaid_items')
        .select('*')
        .eq('item_id', itemId)
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return { success: true, data };
    } catch (error) {
      logger.error('Error fetching item', { error: error.message, itemId });
      return { success: false, error: error.message };
    }
  }

  /**
   * List Plaid items for a given Clerk-derived userId.
   *
   * Used by GET /v1/plaid/items so iOS can answer "is bank already linked?"
   * without trusting client-side keychain state. Returns an empty list (not an
   * error) when the user has no linked items — that is the expected steady state
   * before the first Plaid Link flow completes.
   *
   * @param {string} userId - Clerk JWT sub (req.user.id), never client-supplied
   * @returns {Promise<{ success: boolean, items?: Array, error?: string }>}
   */
  async getItemsForUser(userId) {
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'userId is required' };
    }

    if (!supabase) {
      return this.mockGetItemsForUser(userId);
    }

    try {
      const { data, error } = await supabase
        .from('plaid_items')
        .select('item_id, institution_id, status, updated_at')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const items = (data || []).map((row) => ({
        itemId: row.item_id,
        institutionId: row.institution_id,
        status: row.status,
        updatedAt: row.updated_at,
        accounts: [] // accounts hydration deferred to /v1/plaid/accounts
      }));

      return { success: true, items };
    } catch (error) {
      logger.error('Error fetching items for user', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Resolve the first Plaid access_token for a user, server-side.
   *
   * Per MEM030 the access token MUST be derived from server records and
   * MUST NEVER be accepted from a request body. Used by the single-doc
   * audit pipeline (M001/S04/T02) to call plaidService.getTransactions.
   *
   * @param {string} userId
   * @param {{ route?: string }} [context] caller label for the decrypt
   *   audit event (e.g. 'audit-pipeline')
   * @returns {Promise<string|null>} access token, or null if user has no
   *   Plaid items linked. Errors are logged and surface as null so the
   *   audit pipeline can degrade gracefully (no Plaid evidence) rather
   *   than fail the whole document.
   */
  async getAccessTokenForUser(userId, context = {}) {
    if (!userId || typeof userId !== 'string') {
      return null;
    }

    if (!supabase) {
      // Mock mode: scan in-memory items and return the first one for the user.
      for (const item of this.mockItems.values()) {
        if (item.userId === userId && item.accessToken) {
          return item.accessToken;
        }
      }
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('plaid_items')
        .select('item_id, access_token_encrypted, encryption_version')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1);

      if (error) {
        logger.error('getAccessTokenForUser db error', { error: error.message, userId });
        return null;
      }

      const row = (data || [])[0];
      if (!row) return null;

      return this._decryptRow(userId, row, context);
    } catch (error) {
      logger.error('getAccessTokenForUser error', { error: error.message, userId });
      return null;
    }
  }

  /**
   * Resolve the Plaid access_token for a specific (userId, itemId) pair.
   *
   * Phase 54-02: the public Plaid endpoints (/accounts, /transactions, /item,
   * /item/webhook, DELETE /item) accept ONLY `item_id` from the client. The
   * server resolves the access token here after verifying that the
   * authenticated user owns the item. This closes an IDOR-style hole: a stale
   * or stolen access_token in another user's keychain can no longer be
   * replayed against the API.
   *
   * Phase 54-05: the encrypted column is the sole token source. If the row
   * exists but `access_token_encrypted` is missing (or cannot be decrypted),
   * this FAILS CLOSED with `token_missing` — there is no plaintext fallback.
   *
   * @param {string} userId Clerk-derived req.user.id, never client-supplied
   * @param {string} itemId Plaid item_id from the request body
   * @param {{ route?: string }} [context] caller label (e.g. '/v1/plaid/accounts')
   *   recorded on the `plaid_token_decrypted` audit event
   * @returns {Promise<{ success: true, accessToken: string }
   *                 | { success: false, code: 'not_found' | 'token_missing' | 'error' }>}
   *   `not_found` is returned for both "no such item" AND "item belongs to a
   *   different user" — same shape so callers cannot probe for existence.
   */
  async resolveTokenByItemId(userId, itemId, context = {}) {
    if (!userId || typeof userId !== 'string' || !itemId || typeof itemId !== 'string') {
      return { success: false, code: 'not_found' };
    }

    if (!supabase) {
      // Mock mode: look up by itemId + userId match.
      const item = this.mockItems.get(itemId);
      if (!item || item.userId !== userId || !item.accessToken) {
        return { success: false, code: 'not_found' };
      }
      return { success: true, accessToken: item.accessToken };
    }

    try {
      const { data, error } = await supabase
        .from('plaid_items')
        .select('access_token_encrypted, encryption_version')
        .eq('item_id', itemId)
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // Supabase .single() returns an error when zero rows match — treat as
        // not_found so we don't leak the existence of foreign items.
        if (error && error.code !== 'PGRST116') {
          logger.error('resolveTokenByItemId db error', { error: error.message, itemId, userId });
        }
        return { success: false, code: 'not_found' };
      }

      const accessToken = this._decryptRow(userId, { ...data, item_id: itemId }, context);
      if (!accessToken) {
        // Row exists but has no usable ciphertext — fail closed. Distinct
        // code so callers/ops can tell "needs re-link" from "no such item".
        return { success: false, code: 'token_missing' };
      }
      return { success: true, accessToken };
    } catch (err) {
      logger.error('resolveTokenByItemId error', { error: err.message, itemId, userId });
      return { success: false, code: 'error' };
    }
  }

  /**
   * Private: decrypt the access token from a plaid_items row.
   *
   * Phase 54-05: ciphertext-only — the plaintext column was dropped in
   * migration 008 and there is NO fallback. Missing ciphertext, an
   * unavailable encryption service, or a failed decrypt all return null
   * (callers translate that into `token_missing` / null and the user must
   * re-link via Plaid Link). NEVER logs the resolved token.
   *
   * Phase 54-05: every SUCCESSFUL decrypt emits a structured
   * `plaid_token_decrypted` audit event (userId, itemId, route, timestamp).
   * No token material — plaintext, ciphertext, or derivatives — is logged.
   */
  _decryptRow(userId, row, context = {}) {
    if (!row.access_token_encrypted) {
      logger.error('Plaid item has no encrypted access token - failing closed (re-link required)', {
        itemId: row.item_id,
        userId
      });
      return null;
    }

    const tokenEnc = getTokenEncryption();
    if (!tokenEnc) {
      logger.error('Cannot decrypt Plaid access token - encryption service unavailable', {
        itemId: row.item_id,
        userId
      });
      return null;
    }

    try {
      const accessToken = tokenEnc.decryptFromStorage(userId, row.access_token_encrypted);
      auditLogger.info('plaid_token_decrypted', {
        event: 'plaid_token_decrypted',
        userId,
        itemId: row.item_id,
        route: context.route || 'unknown',
        timestamp: new Date().toISOString()
      });
      return accessToken;
    } catch (decErr) {
      logger.error('Failed to decrypt Plaid access token - failing closed', {
        error: decErr.message,
        itemId: row.item_id,
        userId
      });
      return null;
    }
  }

  /**
   * Create notification for user action required
   */
  async createNotification({ userId, itemId, type, message, priority = 'medium' }) {
    if (!supabase) {
      logger.info('Mock notification', { priority, message, userId });
      return { success: true, mock: true };
    }

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          item_id: itemId,
          type,
          message,
          priority,
          read: false,
          created_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Notification created', { priority, userId });
      return { success: true, data };
    } catch (error) {
      logger.error('Error creating notification', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  // Mock implementations for development/testing
  mockUpsertItem(item) {
    this.mockItems.set(item.itemId, {
      ...item,
      updatedAt: new Date().toISOString()
    });
    logger.debug('Mock: stored item', { itemId: item.itemId });
    return { success: true, mock: true, data: item };
  }

  mockStoreTransactions({ itemId, transactions, userId }) {
    transactions.forEach(transaction => {
      this.mockTransactions.set(transaction.transaction_id, {
        ...transaction,
        itemId,
        userId,
        createdAt: new Date().toISOString()
      });
    });
    logger.debug('Mock: stored transactions', { count: transactions.length });
    return { success: true, mock: true, count: transactions.length };
  }

  mockRemoveTransactions({ transactionIds }) {
    transactionIds.forEach(id => this.mockTransactions.delete(id));
    logger.debug('Mock: removed transactions', { count: transactionIds.length });
    return { success: true, mock: true, count: transactionIds.length };
  }

  mockUpdateItemStatus(update) {
    const item = this.mockItems.get(update.itemId);
    if (item) {
      this.mockItems.set(update.itemId, { ...item, ...update });
      logger.debug('Mock: updated item status', { itemId: update.itemId, status: update.status });
    }
    return { success: true, mock: true, data: update };
  }

  mockUpsertAccounts({ itemId, accounts, userId }) {
    accounts.forEach(account => {
      this.mockAccounts.set(account.account_id, {
        ...account,
        itemId,
        userId,
        updatedAt: new Date().toISOString()
      });
    });
    logger.debug('Mock: stored accounts', { count: accounts.length });
    return { success: true, mock: true, count: accounts.length };
  }

  mockGetItem(itemId) {
    const item = this.mockItems.get(itemId);
    if (item) {
      return { success: true, mock: true, data: item };
    }
    return { success: false, error: 'Item not found' };
  }

  mockGetItemsForUser(userId) {
    const items = [];
    for (const item of this.mockItems.values()) {
      if (item.userId === userId) {
        items.push({
          itemId: item.itemId,
          institutionId: item.institutionId || null,
          status: item.status || 'active',
          updatedAt: item.updatedAt,
          accounts: []
        });
      }
    }
    logger.debug('Mock: listed items for user', { userId, count: items.length });
    return { success: true, mock: true, items };
  }
}

module.exports = new PlaidDataService();