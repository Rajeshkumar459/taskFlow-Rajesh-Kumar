import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterBar from '../components/FilterBar'
import { renderWithProviders } from './utils'
import type { TaskStatus } from '../types'

const MEMBERS = [
  { id: 'user-1', name: 'Alice', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob',   email: 'bob@example.com'   },
]

const baseProps = {
  statusFilter: '' as TaskStatus | '',
  assigneeFilter: '',
  projectMembers: MEMBERS,
  onStatusChange: vi.fn(),
  onAssigneeChange: vi.fn(),
  onClear: vi.fn(),
}

/**
 * MUI v7 Select doesn't wire aria-labelledby between InputLabel and the combobox div,
 * and the label text appears twice (in the <label> and in the fieldset <legend>).
 * Find the <label> element specifically, walk up to FormControl, then get the combobox.
 */
function getSelectByLabel(labelText: string): Element {
  const label = screen
    .getAllByText(labelText)
    .find((el) => el.tagName === 'LABEL')
  if (!label) throw new Error(`No <label> found with text "${labelText}"`)
  const formControl = label.closest('[class*="MuiFormControl"]')
  if (!formControl) throw new Error(`No MuiFormControl found for label "${labelText}"`)
  const combobox = formControl.querySelector('[role="combobox"]')
  if (!combobox) throw new Error(`No combobox found inside FormControl for label "${labelText}"`)
  return combobox
}

/** Check that a <label> with the given text is present */
function expectLabel(text: string) {
  const found = screen.getAllByText(text).some((el) => el.tagName === 'LABEL')
  expect(found, `Expected a <label> with text "${text}"`).toBe(true)
}

function expectNoLabel(text: string) {
  const found = screen.queryAllByText(text).some((el) => el.tagName === 'LABEL')
  expect(found, `Expected no <label> with text "${text}"`).toBe(false)
}

describe('FilterBar', () => {
  it('renders Status and Assignee labels by default', () => {
    renderWithProviders(<FilterBar {...baseProps} />)

    expectLabel('Status')
    expectLabel('Assignee')
  })

  it('hides Status select when hideStatus=true', () => {
    renderWithProviders(<FilterBar {...baseProps} hideStatus />)

    expectNoLabel('Status')
    expectLabel('Assignee')
  })

  it('does not show Clear button when no filters are active', () => {
    renderWithProviders(<FilterBar {...baseProps} statusFilter="" assigneeFilter="" />)

    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })

  it('shows Clear button when a status filter is active', () => {
    renderWithProviders(<FilterBar {...baseProps} statusFilter="todo" />)

    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('shows Clear button when an assignee filter is active', () => {
    renderWithProviders(<FilterBar {...baseProps} assigneeFilter="user-1" />)

    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('calls onClear when Clear filters button is clicked', async () => {
    const onClear = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<FilterBar {...baseProps} statusFilter="todo" onClear={onClear} />)

    await user.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('includes All, Unassigned, and member options in the assignee dropdown', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FilterBar {...baseProps} />)

    await user.click(getSelectByLabel('Assignee'))

    expect(await screen.findByRole('option', { name: /^all$/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /unassigned/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Alice' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Bob' })).toBeInTheDocument()
  })

  it('calls onAssigneeChange when a member is selected', async () => {
    const onAssigneeChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <FilterBar {...baseProps} onAssigneeChange={onAssigneeChange} />
    )

    await user.click(getSelectByLabel('Assignee'))
    await user.click(await screen.findByRole('option', { name: 'Alice' }))

    expect(onAssigneeChange).toHaveBeenCalledWith('user-1')
  })

  it('calls onAssigneeChange with "unassigned" when Unassigned is selected', async () => {
    const onAssigneeChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <FilterBar {...baseProps} onAssigneeChange={onAssigneeChange} />
    )

    await user.click(getSelectByLabel('Assignee'))
    await user.click(await screen.findByRole('option', { name: /unassigned/i }))

    expect(onAssigneeChange).toHaveBeenCalledWith('unassigned')
  })

  it('calls onStatusChange when a status is selected', async () => {
    const onStatusChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <FilterBar {...baseProps} onStatusChange={onStatusChange} />
    )

    await user.click(getSelectByLabel('Status'))
    await user.click(await screen.findByRole('option', { name: /in progress/i }))

    expect(onStatusChange).toHaveBeenCalledWith('in_progress')
  })

  it('status dropdown includes all status options', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FilterBar {...baseProps} />)

    await user.click(getSelectByLabel('Status'))

    expect(await screen.findByRole('option', { name: /^all$/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /to do/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /in progress/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /done/i })).toBeInTheDocument()
  })

  it('renders with empty member list without errors', () => {
    renderWithProviders(<FilterBar {...baseProps} projectMembers={[]} />)
    expectLabel('Assignee')
  })
})
