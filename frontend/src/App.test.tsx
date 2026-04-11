import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import LoginPage from './pages/LoginPage'
import { AuthProvider } from './contexts/AuthContext'

const theme = createTheme()

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <MemoryRouter>{children}</MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<LoginPage />, { wrapper: Wrapper })

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('renders sign in button', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows a link to the register page', () => {
    render(<LoginPage />, { wrapper: Wrapper })
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument()
  })
})

describe('AuthContext', () => {
  it('provides isAuthenticated as false by default', async () => {
    const { AuthProvider, useAuth } = await import('./contexts/AuthContext')

    function TestComponent() {
      const { isAuthenticated, user } = useAuth()
      return (
        <div>
          <span data-testid="auth">{String(isAuthenticated)}</span>
          <span data-testid="user">{user ? user.name : 'none'}</span>
        </div>
      )
    }

    render(
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <MemoryRouter>
            <TestComponent />
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    )

    expect(screen.getByTestId('auth').textContent).toBe('false')
    expect(screen.getByTestId('user').textContent).toBe('none')
  })
})
