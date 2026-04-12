import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskDialog from '../components/TaskDialog'
import { renderWithProviders, TASK } from './utils'

vi.mock('../api/tasks', () => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
}))

import * as tasksApi from '../api/tasks'
import { ApiError } from '../api/client'

const mockCreate = vi.mocked(tasksApi.createTask)
const mockUpdate = vi.mocked(tasksApi.updateTask)

const MEMBERS = [
  { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob',   email: 'bob@example.com'   },
]

const baseProps = {
  open: true,
  onClose: vi.fn(),
  onSaved: vi.fn(),
  projectId: 'proj-1',
  task: null,
  projectMembers: MEMBERS,
  defaultStatus: undefined,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TaskDialog — create mode', () => {
  it('renders dialog with title "New Task"', () => {
    renderWithProviders(<TaskDialog {...baseProps} />)
    expect(screen.getByText('New Task')).toBeInTheDocument()
  })

  it('renders all form fields', () => {
    renderWithProviders(<TaskDialog {...baseProps} />)

    expect(screen.getByLabelText(/^title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    // MUI Select label text appears in both <label> and fieldset legend — check <label> specifically
    expect(screen.getAllByText('Status').some((el) => el.tagName === 'LABEL')).toBe(true)
    expect(screen.getAllByText('Priority').some((el) => el.tagName === 'LABEL')).toBe(true)
    // Autocomplete and date input use standard TextField with for= attribute
    expect(screen.getByLabelText(/assignee/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument()
  })

  it('shows "Create Task" submit button', () => {
    renderWithProviders(<TaskDialog {...baseProps} />)
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument()
  })

  it('defaults status to "todo" and priority to "medium"', () => {
    renderWithProviders(<TaskDialog {...baseProps} />)

    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('applies defaultStatus when provided', () => {
    renderWithProviders(<TaskDialog {...baseProps} defaultStatus="in_progress" />)

    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('shows validation error when submitting with empty title', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TaskDialog {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /create task/i }))

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls createTask with correct data on valid submit', async () => {
    const savedTask = { ...TASK, id: 'new-task', title: 'New Feature' }
    mockCreate.mockResolvedValueOnce(savedTask)
    const user = userEvent.setup()
    renderWithProviders(<TaskDialog {...baseProps} />)

    await user.type(screen.getByLabelText(/^title/i), 'New Feature')
    await user.click(screen.getByRole('button', { name: /create task/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith('proj-1', expect.objectContaining({
        title: 'New Feature',
        status: 'todo',
        priority: 'medium',
      }))
    })
    expect(baseProps.onSaved).toHaveBeenCalledWith(savedTask)
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('shows API error message on failure', async () => {
    mockCreate.mockRejectedValueOnce(new ApiError('Server error', 500))
    const user = userEvent.setup()
    renderWithProviders(<TaskDialog {...baseProps} />)

    await user.type(screen.getByLabelText(/^title/i), 'Bad Task')
    await user.click(screen.getByRole('button', { name: /create task/i }))

    expect(await screen.findByText(/server error/i)).toBeInTheDocument()
  })

  it('shows field-level API errors', async () => {
    mockCreate.mockRejectedValueOnce(
      new ApiError('validation failed', 400, { title: 'is too long' })
    )
    const user = userEvent.setup()
    renderWithProviders(<TaskDialog {...baseProps} />)

    await user.type(screen.getByLabelText(/^title/i), 'Some Task')
    await user.click(screen.getByRole('button', { name: /create task/i }))

    expect(await screen.findByText(/is too long/i)).toBeInTheDocument()
  })

  it('shows loading state while submitting', async () => {
    mockCreate.mockReturnValueOnce(new Promise(() => {}))
    const user = userEvent.setup()
    renderWithProviders(<TaskDialog {...baseProps} />)

    await user.type(screen.getByLabelText(/^title/i), 'Pending Task')
    await user.click(screen.getByRole('button', { name: /create task/i }))

    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled()
  })

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TaskDialog {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(baseProps.onClose).toHaveBeenCalled()
  })
})

describe('TaskDialog — edit mode', () => {
  const editProps = {
    ...baseProps,
    task: TASK,
  }

  it('renders dialog with title "Edit Task"', () => {
    renderWithProviders(<TaskDialog {...editProps} />)
    expect(screen.getByText('Edit Task')).toBeInTheDocument()
  })

  it('shows "Save Changes" submit button', () => {
    renderWithProviders(<TaskDialog {...editProps} />)
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('pre-fills form with existing task values', () => {
    renderWithProviders(<TaskDialog {...editProps} />)

    expect(screen.getByLabelText(/^title/i)).toHaveValue('Fix bug')
    // Status and Priority are selects — check displayed text
    expect(screen.getByText('To Do')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('pre-fills description when task has one', () => {
    renderWithProviders(<TaskDialog {...editProps} />)
    expect(screen.getByLabelText(/description/i)).toHaveValue('A reproducible bug')
  })

  it('calls updateTask with changed values on save', async () => {
    const updated = { ...TASK, title: 'Fixed bug', status: 'done' as const }
    mockUpdate.mockResolvedValueOnce(updated)
    const user = userEvent.setup()
    renderWithProviders(<TaskDialog {...editProps} />)

    const titleInput = screen.getByLabelText(/^title/i)
    await user.clear(titleInput)
    await user.type(titleInput, 'Fixed bug')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(TASK.id, expect.objectContaining({
        title: 'Fixed bug',
      }))
    })
    expect(editProps.onSaved).toHaveBeenCalledWith(updated)
  })

  it('pre-fills assignee when task has assignee_id', () => {
    const taskWithAssignee = { ...TASK, assignee_id: 'user-1' }
    renderWithProviders(<TaskDialog {...baseProps} task={taskWithAssignee} />)

    expect(screen.getByDisplayValue('Alice')).toBeInTheDocument()
  })

  it('resets form when dialog opens for a different task', async () => {
    const { rerender } = renderWithProviders(<TaskDialog {...editProps} open={false} />)

    rerender(<TaskDialog {...editProps} open={true} task={{ ...TASK, title: 'Other Task' }} />)

    expect(screen.getByLabelText(/^title/i)).toHaveValue('Other Task')
  })
})
