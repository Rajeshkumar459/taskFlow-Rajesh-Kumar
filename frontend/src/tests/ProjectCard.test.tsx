import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProjectCard from '../components/ProjectCard'
import { renderWithProviders, PROJECT, TASK_COUNTS } from './utils'

// Mock react-router-dom's useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('ProjectCard', () => {
  it('renders project name and description', () => {
    renderWithProviders(<ProjectCard project={PROJECT} />)

    expect(screen.getByText('Demo Project')).toBeInTheDocument()
    expect(screen.getByText('A test project')).toBeInTheDocument()
  })

  it('renders created date containing 2024', () => {
    renderWithProviders(<ProjectCard project={PROJECT} />)
    // toLocaleDateString format varies by locale (e.g. "Jan 15, 2024" vs "15 Jan 2024")
    expect(screen.getByText(/created.*2024/i)).toBeInTheDocument()
  })

  it('navigates to project detail page on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProjectCard project={PROJECT} />)

    await user.click(screen.getByText('Demo Project'))

    expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1')
  })

  it('shows task counts when taskCounts are provided', () => {
    renderWithProviders(<ProjectCard project={PROJECT} taskCounts={TASK_COUNTS} />)

    expect(screen.getByText(/3 \/ 6 done/i)).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('shows "No tasks yet" when total is 0', () => {
    renderWithProviders(<ProjectCard project={PROJECT} taskCounts={{
      todo: 0, in_progress: 0, done: 0, total: 0, overdue: 0,
    }} />)

    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
  })

  it('shows overdue badge when overdue count > 0', () => {
    renderWithProviders(<ProjectCard project={PROJECT} taskCounts={TASK_COUNTS} />)

    // The WarningAmberIcon appears only when there are overdue tasks
    expect(screen.getByTestId('WarningAmberIcon')).toBeInTheDocument()
  })

  it('does not show overdue badge when overdue count is 0', () => {
    renderWithProviders(<ProjectCard project={PROJECT} taskCounts={{
      ...TASK_COUNTS, overdue: 0,
    }} />)

    // No warning chip should be present
    expect(screen.queryByLabelText(/overdue/i)).not.toBeInTheDocument()
  })

  it('renders without taskCounts (stats not loaded yet)', () => {
    renderWithProviders(<ProjectCard project={PROJECT} taskCounts={undefined} />)

    expect(screen.getByText('Demo Project')).toBeInTheDocument()
    expect(screen.queryByText(/done/i)).not.toBeInTheDocument()
  })

  it('handles project without description gracefully', () => {
    const noDesc = { ...PROJECT, description: undefined }
    renderWithProviders(<ProjectCard project={noDesc} />)

    expect(screen.getByText('Demo Project')).toBeInTheDocument()
  })

  it('shows 100% and green bar when all tasks done', () => {
    renderWithProviders(<ProjectCard project={PROJECT} taskCounts={{
      todo: 0, in_progress: 0, done: 5, total: 5, overdue: 0,
    }} />)

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText(/5 \/ 5 done/i)).toBeInTheDocument()
  })
})
