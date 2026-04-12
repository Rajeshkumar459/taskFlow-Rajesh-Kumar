import Chip from '@mui/material/Chip'
import { alpha } from '@mui/material/styles'
import type { TaskStatus } from '../types'

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string }> = {
  todo:        { label: 'To Do',       color: '#64748b' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  done:        { label: 'Done',        color: '#10b981' },
}

interface Props {
  status: TaskStatus
  size?: 'small' | 'medium'
  onClick?: () => void
}

export default function TaskStatusChip({ status, size = 'small', onClick }: Props) {
  const { label, color } = STATUS_CONFIG[status]

  return (
    <Chip
      label={label}
      size={size}
      onClick={onClick}
      sx={{
        bgcolor: alpha(color, 0.12),
        color,
        border: `1px solid ${alpha(color, 0.3)}`,
        fontWeight: 600,
        fontSize: size === 'small' ? '0.72rem' : '0.8rem',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { bgcolor: alpha(color, 0.2) } : {},
        '.MuiChip-label': { px: 1.25 },
      }}
    />
  )
}
