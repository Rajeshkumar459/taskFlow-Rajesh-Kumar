import { useState, useEffect } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Autocomplete from '@mui/material/Autocomplete'
import { ApiError } from '../api/client'
import { createTask, updateTask } from '../api/tasks'
import type { Task, User, TaskStatus, Priority } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (task: Task) => void
  projectId: string
  task?: Task | null
  projectMembers: User[]
  defaultStatus?: TaskStatus
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
]

export default function TaskDialog({ open, onClose, onSaved, projectId, task, projectMembers, defaultStatus }: Props) {
  const isEdit = !!task

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [priority, setPriority] = useState<Priority>('medium')
  const [assignee, setAssignee] = useState<User | null>(null)
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title)
        setDescription(task.description ?? '')
        setStatus(task.status)
        setPriority(task.priority)
        setAssignee(projectMembers.find((m) => m.id === task.assignee_id) ?? null)
        setDueDate(task.due_date ? task.due_date.split('T')[0] : '')
      } else {
        setTitle('')
        setDescription('')
        setStatus(defaultStatus ?? 'todo')
        setPriority('medium')
        setAssignee(null)
        setDueDate('')
      }
      setError('')
      setFieldErrors({})
    }
  }, [open, task, projectMembers, defaultStatus])

  const handleClose = () => {
    setError('')
    setFieldErrors({})
    onClose()
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      setFieldErrors({ title: 'Title is required' })
      return
    }

    setLoading(true)
    setError('')
    setFieldErrors({})

    try {
      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assignee_id: assignee?.id,
        due_date: dueDate || undefined,
      }

      let saved: Task
      if (isEdit && task) {
        saved = await updateTask(task.id, data)
      } else {
        saved = await createTask(projectId, data)
      }

      onSaved(saved)
      handleClose()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          setFieldErrors(err.fields)
        } else {
          setError(err.message)
        }
      } else {
        setError('Failed to save task')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>{isEdit ? 'Edit Task' : 'New Task'}</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField
              autoFocus
              label="Title"
              fullWidth
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={!!fieldErrors.title}
              helperText={fieldErrors.title}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Description (optional)"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Grid>
          <Grid size={6}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={6}>
            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                label="Priority"
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {/* Assignee full-width so autocomplete dropdown has room */}
          <Grid size={12}>
            <Autocomplete
              options={projectMembers}
              getOptionLabel={(u) => u.name}
              value={assignee}
              onChange={(_, val) => setAssignee(val)}
              renderInput={(params) => <TextField {...params} label="Assignee (optional)" />}
            />
          </Grid>
          {/* Due date full-width — prevents the native calendar popup from
              overflowing the dialog when the field is in a narrow half-column */}
          <Grid size={12}>
            <TextField
              label="Due Date (optional)"
              type="date"
              fullWidth
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
