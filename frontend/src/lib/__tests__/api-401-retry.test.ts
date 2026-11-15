/**
 * Phase 56-03 — fetchWithAuth one-shot 401 refresh retry.
 *
 * Mirrors the iOS APIClient `onAuthenticationRequired` contract:
 *   - 200 returned unchanged, no retry.
 *   - 401 once → forced-refresh getToken (skipCache:true) and retry once.
 *   - 401 twice → propagate (no infinite loop).
 *   - 403/500 → no retry (only 401 triggers refresh).
 *   - getToken returns null → no Authorization header, no retry on 401
 *     (nothing to refresh).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithAuth, ApiError } from '../api'

type FetchMock = ReturnType<typeof vi.fn>

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchWithAuth — one-shot 401 refresh retry', () => {
  let fetchSpy: FetchMock

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns 200 as-is and does not call getToken twice', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    const getToken = vi.fn().mockResolvedValue('valid-token')

    const result = await fetchWithAuth('/cases', getToken)

    expect(result).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(getToken).toHaveBeenCalledTimes(1)
    expect(getToken).toHaveBeenCalledWith({ skipCache: false })

    // First (and only) request carries the Authorization header
    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer valid-token')
  })

  it('retries once on 401 with skipCache:true and returns the retry response', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))
    const getToken = vi
      .fn()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token')

    const result = await fetchWithAuth('/cases', getToken)

    expect(result).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenCalledTimes(2)
    expect(getToken).toHaveBeenNthCalledWith(1, { skipCache: false })
    expect(getToken).toHaveBeenNthCalledWith(2, { skipCache: true })

    // Retry uses the fresh token
    const retryHeaders = (fetchSpy.mock.calls[1][1] as RequestInit).headers as Record<string, string>
    expect(retryHeaders['Authorization']).toBe('Bearer fresh-token')
  })

  it('does not loop: second 401 propagates as ApiError(401)', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(401, { message: 'still expired' }))
    const getToken = vi.fn().mockResolvedValue('any-token')

    await expect(fetchWithAuth('/cases', getToken)).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(2) // exactly one retry, never a third
  })

  it('does not retry on non-401 statuses (403, 500)', async () => {
    // 403
    fetchSpy.mockResolvedValueOnce(jsonResponse(403, { message: 'forbidden' }))
    const getToken403 = vi.fn().mockResolvedValue('token')
    await expect(fetchWithAuth('/cases', getToken403)).rejects.toBeInstanceOf(ApiError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(getToken403).toHaveBeenCalledTimes(1)

    // 500
    fetchSpy.mockResolvedValueOnce(jsonResponse(500, { message: 'oops' }))
    const getToken500 = vi.fn().mockResolvedValue('token')
    await expect(fetchWithAuth('/cases', getToken500)).rejects.toBeInstanceOf(ApiError)
    // fetch called once more (now 2 total across the two requests)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(getToken500).toHaveBeenCalledTimes(1)
  })

  it('omits Authorization when getToken returns null and does not retry on 401', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(401, { message: 'no session' }))
    const getToken = vi.fn().mockResolvedValue(null)

    await expect(fetchWithAuth('/cases', getToken)).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // getToken called twice: once for the initial request, once during the
    // 401 branch where we re-check whether a refresh is even possible. With
    // null the wrapper short-circuits without a retry fetch.
    expect(getToken).toHaveBeenCalledTimes(2)

    const headers = (fetchSpy.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })
})
