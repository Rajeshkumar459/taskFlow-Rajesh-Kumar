export const TOKEN_KEY = 'taskflow_token'

export const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8080'

export class ApiError extends Error {
  status: number
  fields?: Record<string, string>

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fields = fields
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    // Clear stored auth on 401
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem('taskflow_user')
    // Dispatch event so AuthContext can react
    window.dispatchEvent(new Event('auth:logout'))
    throw new ApiError('Unauthorized', 401)
  }

  if (res.status === 204) {
    return undefined as T
  }

  const data = await res.json()

  if (!res.ok) {
    throw new ApiError(
      data.error ?? 'Request failed',
      res.status,
      data.fields
    )
  }

  return data as T
}
