const Joi = require('joi');

/**
 * Schema for POST /v1/plaid/link_token
 * Create Plaid Link token for bank connection.
 */
const linkTokenSchema = Joi.object({
  // user_id is accepted for backwards compatibility with older clients but is
  // ignored by the handler — the authenticated Clerk user (req.user.id) is the
  // sole source of truth for ownership. See routes/plaid.js POST /link_token.
  user_id: Joi.string().trim().max(255).optional(),
  client_name: Joi.string().trim().optional(),
  redirect_uri: Joi.string().trim().uri().optional(),
  access_token: Joi.string().trim().optional(),
  products: Joi.array().items(Joi.string()).optional()
});

/**
 * Schema for POST /v1/plaid/exchange_token
 * Exchange public token for access token.
 */
const exchangeTokenSchema = Joi.object({
  public_token: Joi.string().trim().pattern(/^public-/).message('Invalid public token format').required(),
  user_id: Joi.string().trim().optional(),
  institution_id: Joi.string().trim().optional()
});

/**
 * Phase 54-02: the five Plaid endpoints below take `item_id` from the client.
 * The server resolves the access_token from plaid_items after verifying the
 * authenticated Clerk user owns the item. `access_token` MUST NEVER appear in
 * these request bodies — explicitly forbidden so stale clients surface a 400
 * instead of being silently stripped by the `stripUnknown: true` validate
 * middleware option.
 */
const itemIdField = Joi.string().trim().min(1).max(255).required();
const forbiddenAccessToken = Joi.any().forbidden().messages({
  'any.unknown': 'access_token is no longer accepted in this endpoint; send item_id instead'
});

/**
 * Schema for POST /v1/plaid/accounts
 * Get account information.
 */
const accountsSchema = Joi.object({
  item_id: itemIdField,
  account_ids: Joi.array().items(Joi.string()).optional()
}).unknown(false);

/**
 * Schema for POST /v1/plaid/transactions
 * Get transaction history with pagination.
 */
const transactionsSchema = Joi.object({
  item_id: itemIdField,
  start_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('Dates must be in YYYY-MM-DD format').required(),
  end_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('Dates must be in YYYY-MM-DD format').required(),
  account_ids: Joi.array().items(Joi.string()).optional(),
  count: Joi.number().integer().min(1).max(500).default(100),
  offset: Joi.number().integer().min(0).default(0)
}).unknown(false);

/**
 * Schema for POST /v1/plaid/item
 * Get item (bank connection) information.
 */
const itemSchema = Joi.object({
  item_id: itemIdField
}).unknown(false);

/**
 * Schema for POST /v1/plaid/item/webhook
 * Update webhook URL for an item.
 */
const updateWebhookSchema = Joi.object({
  item_id: itemIdField,
  webhook: Joi.string().trim().uri().required()
}).unknown(false);

/**
 * Schema for DELETE /v1/plaid/item
 * Remove (delete) an item and revoke access.
 */
const deleteItemSchema = Joi.object({
  item_id: itemIdField
}).unknown(false);

/**
 * Schema for POST /v1/plaid/sandbox_public_token
 * Create sandbox public token (for testing only).
 */
const sandboxTokenSchema = Joi.object({
  institution_id: Joi.string().trim().optional(),
  initial_products: Joi.array().items(Joi.string()).optional()
});

module.exports = {
  linkTokenSchema,
  exchangeTokenSchema,
  accountsSchema,
  transactionsSchema,
  itemSchema,
  updateWebhookSchema,
  deleteItemSchema,
  sandboxTokenSchema
};
