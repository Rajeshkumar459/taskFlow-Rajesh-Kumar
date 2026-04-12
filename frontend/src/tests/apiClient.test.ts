import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError, apiFetch, TOKEN_KEY } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const response = new Response(
    status === 204 ? null : JSON.stringify(body),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    }
  )
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response))
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

// ── ApiError ──────────────────────────────────────────────────────────────────

describe('ApiError', () => {
  it('is instanceof Error', () => {
    const err = new ApiError('oops', 400)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
  })

  it('stores status and message', () => {
    const err = new ApiError('Not found', 404)
    expect(err.message).toBe('Not found')
    expect(err.status).toBe(404)
    expect(err.fields).toBeUndefined()
  })

  it('stores field errors when provided', () => {
    const err = new ApiError('Validation failed', 400, { email: 'is invalid' })
    expect(err.fields).toEqual({ email: 'is invalid' })
  })

  it('has name ApiError', () => {
    expect(new ApiError('x', 500).name).toBe('ApiError')
  })
})

// ── apiFetch ──────────────────────────────────────────────────────────────────

describe('apiFetch', () => {
  it('returns parsed JSON on 200', async () => {
    mockFetch(200, { id: '1', name: 'Test' })

    const result = await apiFetch<{ id: string; name: string }>('/test')

    expect(result).toEqual({ id: '1', name: 'Test' })
  })

  it('sends Content-Type: application/json', async () => {
    mockFetch(200, {})
    const fetchSpy = vi.mocked(fetch)

    await apiFetch('/test')

    const [, options] = fetchSpy.mock.calls[0]
    const headers = options?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('attaches Authorization header when token exists in localStorage', async () => {
    localStorage.setItem(TOKEN_KEY, 'my-token')
    mockFetch(200, {})
    const fetchSpy = vi.mocked(fetch)

    await apiFetch('/test')

    const [, options] = fetchSpy.mock.calls[0]
    const headers = options?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer my-token')
  })

  it('does not attach Authorization header when no token in localStorage', async () => {
    mockFetch(200, {})
    const fetchSpy = vi.mocked(fetch)

    await apiFetch('/test')

    const [, options] = fetchSpy.mock.calls[0]
    const headers = options?.headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  it('returns undefined for 204 No Content', async () => {
    mockFetch(204, null)

    const result = await apiFetch('/test')

    expect(result).toBeUndefined()
  })

  it('throws ApiError on 400 with error message', async () => {
    mockFetch(400, { error: 'Bad request' })

    await expect(apiFetch('/test')).rejects.toMatchObject({
      message: 'Bad request',
      status: 400,
    })
  })

  it('throws ApiError on 400 with field errors', async () => {
    mockFetch(400, { error: 'Validation failed', fields: { name: 'is required' } })

    let caught: ApiError | undefined
    try {
      await apiFetch('/test')
    } catch (e) {
      caught = e as ApiError
    }

    expect(caught).toBeInstanceOf(ApiError)
    expect(caught?.fields).toEqual({ name: 'is required' })
  })

  it('throws ApiError with status 500 on server error', async () => {
    mockFetch(500, { error: 'Internal server error' })

    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 500 })
  })

  it('on 401: clears localStorage token and dispatches auth:logout event', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token')
    localStorage.setItem('taskflow_user', '{"id":"1","name":"Alice","email":"a@b.c"}')
    mockFetch(401, { error: 'Unauthorized' })

    const eventSpy = vi.fn()
    window.addEventListener('auth:logout', eventSpy)

    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 401 })

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem('taskflow_user')).toBeNull()
    expect(eventSpy).toHaveBeenCalledTimes(1)

    window.removeEventListener('auth:logout', eventSpy)
  })

  it('forwards request body and method', async () => {
    mockFetch(201, { id: 'new' })
    const fetchSpy = vi.mocked(fetch)

    await apiFetch('/items', {
      method: 'POST',
      body: JSON.stringify({ name: 'Item' }),
    })

    const [, options] = fetchSpy.mock.calls[0]
    expect(options?.method).toBe('POST')
    expect(options?.body).toBe(JSON.stringify({ name: 'Item' }))
  })
})
