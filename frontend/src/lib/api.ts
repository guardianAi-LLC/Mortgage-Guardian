const API_BASE = '/api/v1'

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Token getter contract. Implementations forward `skipCache: true` to
 * `useAuth().getToken({ skipCache: true })` to force-refresh an expired
 * Clerk JWT. Returning null means "no auth token available" — the request
 * is sent without an Authorization header and 401s are not retried.
 *
 * Mirrors the iOS APIClient `onAuthenticationRequired` contract: one retry
 * per request, second 401 propagates.
 */
export type TokenGetter = (opts?: { skipCache?: boolean }) => Promise<string | null>

/**
 * Phase 56-03: fetchWithAuth now accepts a token getter rather than a
 * pre-fetched token string. On a 401 response, it calls `getToken` again
 * with `{ skipCache: true }` and retries exactly once. A second 401 (or
 * any non-401 status) propagates without further retry — no infinite loop.
 *
 * Mirrors `MortgageGuardian/Networking/APIClient.swift` behavior; covered
 * by `src/lib/__tests__/api-401-retry.test.ts`.
 */
// Preserve the prior implicit `Promise<any>` return so call sites that
// access response shape fields without runtime guards continue to compile.
// Callers downstream apply their own mapping/typing (see lib/hooks.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchWithAuth(
  path: string,
  getToken: TokenGetter,
  options: RequestInit = {}
): Promise<any> {
  const doFetch = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    return fetch(`${API_BASE}${path}`, { ...options, headers })
  }

  const initialToken = await getToken({ skipCache: false })
  let res = await doFetch(initialToken)

  if (res.status === 401) {
    // One-shot refresh retry. If getToken still returns null (no Clerk
    // session), there is nothing to refresh — propagate the 401 without
    // a second fetch.
    const refreshed = await getToken({ skipCache: true })
    if (refreshed) {
      res = await doFetch(refreshed)
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message || 'Request failed')
  }

  return res.json()
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  return new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
}

export const api = {
  cases: {
    list: (getToken: TokenGetter, params?: { status?: string; limit?: number; offset?: number }) =>
      fetchWithAuth(`/cases?${qs(params)}`, getToken),
    get: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/cases/${id}`, getToken),
    create: (getToken: TokenGetter, data: { caseName: string; borrowerName?: string; propertyAddress?: string; loanNumber?: string; servicerName?: string; notes?: string }) =>
      fetchWithAuth('/cases', getToken, { method: 'POST', body: JSON.stringify(data) }),
    update: (getToken: TokenGetter, id: string, data: Record<string, unknown>) =>
      fetchWithAuth(`/cases/${id}`, getToken, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/cases/${id}`, getToken, { method: 'DELETE' }),
    addDocument: (getToken: TokenGetter, caseId: string, documentId: string) =>
      fetchWithAuth(`/cases/${caseId}/documents`, getToken, { method: 'POST', body: JSON.stringify({ documentId }) }),
    removeDocument: (getToken: TokenGetter, caseId: string, documentId: string) =>
      fetchWithAuth(`/cases/${caseId}/documents/${documentId}`, getToken, { method: 'DELETE' }),
  },

  documents: {
    list: (getToken: TokenGetter, params?: { limit?: number; offset?: number }) =>
      fetchWithAuth(`/documents?${qs(params)}`, getToken),
    get: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/documents/${id}`, getToken),
    upload: (getToken: TokenGetter, data: { documentId: string; fileName: string; content: string; documentType?: string }) =>
      fetchWithAuth('/documents/upload', getToken, { method: 'POST', body: JSON.stringify(data) }),
    process: (getToken: TokenGetter, data: { documentId: string; documentText?: string; fileBuffer?: string; documentType?: string }) =>
      fetchWithAuth('/documents/process', getToken, { method: 'POST', body: JSON.stringify(data) }),
    status: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/documents/${id}/status`, getToken),
    analysis: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/documents/${id}/analysis`, getToken),
    complete: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/documents/${id}/complete`, getToken, { method: 'POST' }),
    retry: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/documents/${id}/retry`, getToken, { method: 'POST' }),
    delete: (getToken: TokenGetter, id: string) =>
      fetchWithAuth(`/documents/${id}`, getToken, { method: 'DELETE' }),
  },

  forensic: {
    run: (getToken: TokenGetter, caseId: string, data?: Record<string, unknown>) =>
      fetchWithAuth(`/cases/${caseId}/forensic-analysis`, getToken, { method: 'POST', body: JSON.stringify(data || {}) }),
    get: (getToken: TokenGetter, caseId: string) =>
      fetchWithAuth(`/cases/${caseId}/forensic-analysis`, getToken),
  },

  compliance: {
    evaluate: (getToken: TokenGetter, caseId: string, data?: Record<string, unknown>) =>
      fetchWithAuth(`/cases/${caseId}/compliance`, getToken, { method: 'POST', body: JSON.stringify(data || {}) }),
    get: (getToken: TokenGetter, caseId: string) =>
      fetchWithAuth(`/cases/${caseId}/compliance`, getToken),
  },

  reports: {
    generate: (getToken: TokenGetter, caseId: string, data?: { generateLetter?: boolean; letterType?: string; skipPersistence?: boolean }) =>
      fetchWithAuth(`/cases/${caseId}/report`, getToken, { method: 'POST', body: JSON.stringify(data || {}) }),
    get: (getToken: TokenGetter, caseId: string) =>
      fetchWithAuth(`/cases/${caseId}/report`, getToken),
    generateLetter: (getToken: TokenGetter, caseId: string, data: { letterType: string }) =>
      fetchWithAuth(`/cases/${caseId}/report/letter`, getToken, { method: 'POST', body: JSON.stringify(data) }),
  },

  plaid: {
    createLinkToken: (getToken: TokenGetter, data: { userId: string }) =>
      fetchWithAuth('/plaid/link_token', getToken, { method: 'POST', body: JSON.stringify({ user_id: data.userId }) }),
    exchangeToken: (getToken: TokenGetter, data: { publicToken: string; institution?: object }) =>
      fetchWithAuth('/plaid/exchange_token', getToken, { method: 'POST', body: JSON.stringify({ public_token: data.publicToken, institution: data.institution }) }),
    listItems: (getToken: TokenGetter) =>
      fetchWithAuth('/plaid/items', getToken),
    getAccounts: (getToken: TokenGetter, itemId: string) =>
      fetchWithAuth('/plaid/accounts', getToken, { method: 'POST', body: JSON.stringify({ item_id: itemId }) }),
    getTransactions: (getToken: TokenGetter, data: { itemId: string; startDate?: string; endDate?: string }) =>
      fetchWithAuth('/plaid/transactions', getToken, { method: 'POST', body: JSON.stringify({ item_id: data.itemId, start_date: data.startDate, end_date: data.endDate }) }),
    getItem: (getToken: TokenGetter, itemId: string) =>
      fetchWithAuth('/plaid/item', getToken, { method: 'POST', body: JSON.stringify({ item_id: itemId }) }),
    deleteItem: (getToken: TokenGetter, itemId: string) =>
      fetchWithAuth('/plaid/item', getToken, { method: 'DELETE', body: JSON.stringify({ item_id: itemId }) }),
  },

  health: {
    check: () => fetch('/health').then(r => r.json()),
    live: () => fetch('/health/live').then(r => r.json()),
    ready: () => fetch('/health/ready').then(r => r.json()),
  },
}
