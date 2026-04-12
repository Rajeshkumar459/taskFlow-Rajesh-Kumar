import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskStatusChip from '../components/TaskStatusChip'
import { renderWithProviders } from './utils'

describe('TaskStatusChip', () => {
  it.each([
    ['todo',        'To Do'],
    ['in_progress', 'In Progress'],
    ['done',        'Done'],
  ] as const)('renders correct label for status=%s', (status, label) => {
    renderWithProviders(<TaskStatusChip status={status} />)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handler = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<TaskStatusChip status="todo" onClick={handler} />)

    await user.click(screen.getByText('To Do'))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not crash when onClick is not provided', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TaskStatusChip status="done" />)
    // Just click and make sure no error is thrown
    await user.click(screen.getByText('Done'))
  })

  it('renders all three statuses without overlap', () => {
    const { rerender } = renderWithProviders(<TaskStatusChip status="todo" />)
    expect(screen.getByText('To Do')).toBeInTheDocument()

    rerender(<TaskStatusChip status="in_progress" />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    rerender(<TaskStatusChip status="done" />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })
})
