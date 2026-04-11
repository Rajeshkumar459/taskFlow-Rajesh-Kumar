import Chip from '@mui/material/Chip'
import type { TaskStatus } from '../types'

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const STATUS_COLORS: Record<TaskStatus, 'default' | 'primary' | 'success'> = {
  todo: 'default',
  in_progress: 'primary',
  done: 'success',
}

interface Props {
  status: TaskStatus
  size?: 'small' | 'medium'
  onClick?: () => void
}

export default function TaskStatusChip({ status, size = 'small', onClick }: Props) {
  return (
    <Chip
      label={STATUS_LABELS[status]}
      color={STATUS_COLORS[status]}
      size={size}
      onClick={onClick}
      sx={onClick ? { cursor: 'pointer' } : undefined}
    />
  )
}
