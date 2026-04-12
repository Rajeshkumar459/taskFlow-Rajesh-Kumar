import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import ProtectedRoute from '../components/ProtectedRoute'
import { renderWithProviders, USER } from './utils'

// ── Mock API modules ──────────────────────────────────────────────────────────

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
}))

import * as authApi from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockLogin    = vi.mocked(authApi.login)
const mockRegister = vi.mocked(authApi.register)

function successResponse() {
  return { token: 'fake-jwt', user: USER }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

// ── LoginPage ─────────────────────────────────────────────────────────────────

describe('LoginPage', () => {
  it('renders email, password fields and sign-in button', () => {
    renderWithProviders(<LoginPage />)

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows a link to the register page', () => {
    renderWithProviders(<LoginPage />)
    const link = screen.getByRole('link', { name: /create one/i })
    expect(link).toHaveAttribute('href', '/register')
  })

  it('shows client-side validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('shows validation error for invalid email format', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.type(screen.getByLabelText(/^password/i), 'pass1234')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('calls login API with trimmed email and navigates on success', async () => {
    mockLogin.mockResolvedValueOnce(successResponse())
    const user = userEvent.setup()

    renderWithProviders(<LoginPage />, {
      routerProps: { initialEntries: ['/login'] },
    })

    await user.type(screen.getByLabelText(/email address/i), '  alice@example.com  ')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('alice@example.com', 'password123')
    })
  })

  it('shows API error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new ApiError('Invalid credentials', 401))
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument()
  })

  it('shows field-level errors from the API', async () => {
    mockLogin.mockRejectedValueOnce(
      new ApiError('validation failed', 400, { email: 'is already taken' })
    )
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/is already taken/i)).toBeInTheDocument()
  })

  it('disables the button and shows loading text while submitting', async () => {
    // Never resolves — keeps loading state
    mockLogin.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('button', { name: /signing in/i })).toBeDisabled()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />)

    const pwdField = screen.getByLabelText(/^password/i)
    expect(pwdField).toHaveAttribute('type', 'password')

    // MUI icons have data-testid set to the component name
    await user.click(screen.getByTestId('VisibilityRoundedIcon'))

    expect(pwdField).toHaveAttribute('type', 'text')
  })
})

// ── RegisterPage ──────────────────────────────────────────────────────────────

describe('RegisterPage', () => {
  it('renders name, email, password fields and create-account button', () => {
    renderWithProviders(<RegisterPage />)

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('shows a link back to login', () => {
    renderWithProviders(<RegisterPage />)
    const link = screen.getByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', '/login')
  })

  it('shows validation errors when submitted empty', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('validates password length', async () => {
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.type(screen.getByLabelText(/full name/i), 'Alice')
    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'short')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('calls register API with correct args and navigates on success', async () => {
    mockRegister.mockResolvedValueOnce(successResponse())
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.type(screen.getByLabelText(/full name/i), 'Alice Smith')
    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Alice Smith', 'alice@example.com', 'password123')
    })
  })

  it('shows API error alert on failed registration', async () => {
    mockRegister.mockRejectedValueOnce(new ApiError('Email already taken', 400))
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.type(screen.getByLabelText(/full name/i), 'Alice')
    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/email already taken/i)).toBeInTheDocument()
  })

  it('shows loading state while submitting', async () => {
    mockRegister.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderWithProviders(<RegisterPage />)

    await user.type(screen.getByLabelText(/full name/i), 'Alice')
    await user.type(screen.getByLabelText(/email address/i), 'alice@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByRole('button', { name: /creating account/i })).toBeDisabled()
  })
})

// ── AuthContext ────────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  it('starts unauthenticated when localStorage is empty', () => {
    function Probe() {
      const { isAuthenticated, user } = useAuth()
      return (
        <>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <span data-testid="user">{user?.name ?? 'none'}</span>
        </>
      )
    }

    renderWithProviders(<Probe />)

    expect(screen.getByTestId('auth')).toHaveTextContent('false')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('reads existing token and user from localStorage on mount', () => {
    function Probe() {
      const { isAuthenticated, user } = useAuth()
      return (
        <>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <span data-testid="user">{user?.name ?? 'none'}</span>
        </>
      )
    }

    renderWithProviders(<Probe />, {
      authToken: 'existing-token',
      authUser: USER,
    })

    expect(screen.getByTestId('auth')).toHaveTextContent('true')
    expect(screen.getByTestId('user')).toHaveTextContent('Alice Smith')
  })

  it('login() stores token and user in localStorage', async () => {
    function Probe() {
      const { login, isAuthenticated } = useAuth()
      return (
        <>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <button onClick={() => login('new-token', USER)}>Log in</button>
        </>
      )
    }

    const user = userEvent.setup()
    renderWithProviders(<Probe />)

    expect(screen.getByTestId('auth')).toHaveTextContent('false')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(screen.getByTestId('auth')).toHaveTextContent('true')
    expect(localStorage.getItem('taskflow_token')).toBe('new-token')
  })

  it('logout() clears token, user, and isAuthenticated', async () => {
    function Probe() {
      const { logout, isAuthenticated } = useAuth()
      return (
        <>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <button onClick={logout}>Log out</button>
        </>
      )
    }

    const user = userEvent.setup()
    renderWithProviders(<Probe />, { authToken: 'tok', authUser: USER })

    expect(screen.getByTestId('auth')).toHaveTextContent('true')
    await user.click(screen.getByRole('button', { name: /log out/i }))

    expect(screen.getByTestId('auth')).toHaveTextContent('false')
    expect(localStorage.getItem('taskflow_token')).toBeNull()
    expect(localStorage.getItem('taskflow_user')).toBeNull()
  })
})

// ── ProtectedRoute ─────────────────────────────────────────────────────────────

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<div>Projects</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      { routerProps: { initialEntries: ['/projects'] } }
    )

    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Projects')).not.toBeInTheDocument()
  })

  it('renders child route when authenticated', () => {
    renderWithProviders(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<div>Projects</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>,
      {
        routerProps: { initialEntries: ['/projects'] },
        authToken: 'valid-token',
        authUser: USER,
      }
    )

    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
  })
})
