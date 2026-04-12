import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import type { TaskStatus, User } from '../types'

interface Props {
  statusFilter: TaskStatus | ''
  assigneeFilter: string
  projectMembers: User[]
  onStatusChange: (v: TaskStatus | '') => void
  onAssigneeChange: (v: string) => void
  onClear: () => void
  hideStatus?: boolean
}

export default function FilterBar({
  statusFilter,
  assigneeFilter,
  projectMembers,
  onStatusChange,
  onAssigneeChange,
  onClear,
  hideStatus = false,
}: Props) {
  const hasFilters = statusFilter !== '' || assigneeFilter !== ''

  return (
    <Box sx={{ display: 'flex', gap: { xs: 1.5, sm: 2 }, flexWrap: 'wrap', alignItems: 'center' }}>
      {!hideStatus && (
        <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 140 }, flex: { xs: 1, sm: 'none' } }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => onStatusChange(e.target.value as TaskStatus | '')}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="todo">To Do</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="done">Done</MenuItem>
          </Select>
        </FormControl>
      )}

      <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 160 }, flex: { xs: 1, sm: 'none' } }}>
        <InputLabel>Assignee</InputLabel>
        <Select
          value={assigneeFilter}
          label="Assignee"
          onChange={(e) => onAssigneeChange(e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="unassigned">Unassigned</MenuItem>
          {projectMembers.map((m) => (
            <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {hasFilters && (
        <Button size="small" onClick={onClear} sx={{ whiteSpace: 'nowrap' }}>
          Clear filters
        </Button>
      )}
    </Box>
  )
}
