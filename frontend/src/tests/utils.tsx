/**
 * Shared test utilities — import from here in every test file.
 */
import React from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { AuthProvider } from '../contexts/AuthContext'

const theme = createTheme()

interface WrapperOptions {
  routerProps?: MemoryRouterProps
  /** Pre-seed localStorage so AuthProvider boots as authenticated */
  authToken?: string
  authUser?: { id: string; name: string; email: string }
}

export function createWrapper(opts: WrapperOptions = {}) {
  if (opts.authToken) localStorage.setItem('taskflow_token', opts.authToken)
  if (opts.authUser)  localStorage.setItem('taskflow_user', JSON.stringify(opts.authUser))

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <MemoryRouter {...opts.routerProps}>{children}</MemoryRouter>
        </AuthProvider>
      </ThemeProvider>
    )
  }
}

/** renderWithProviders — thin wrapper around RTL render with default providers */
export function renderWithProviders(
  ui: React.ReactElement,
  opts: WrapperOptions = {},
  renderOptions?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: createWrapper(opts), ...renderOptions })
}

/** A minimal Project fixture */
export const PROJECT = {
  id: 'proj-1',
  name: 'Demo Project',
  description: 'A test project',
  owner_id: 'user-1',
  created_at: '2024-01-15T12:00:00Z',
}

/** A minimal Task fixture */
export const TASK = {
  id: 'task-1',
  title: 'Fix bug',
  description: 'A reproducible bug',
  status: 'todo' as const,
  priority: 'medium' as const,
  project_id: 'proj-1',
  created_at: '2024-01-15T12:00:00Z',
  updated_at: '2024-01-15T12:00:00Z',
}

/** A minimal User fixture */
export const USER = {
  id: 'user-1',
  name: 'Alice Smith',
  email: 'alice@example.com',
}

/** A minimal TaskCounts fixture */
export const TASK_COUNTS = {
  todo: 2,
  in_progress: 1,
  done: 3,
  total: 6,
  overdue: 1,
}
