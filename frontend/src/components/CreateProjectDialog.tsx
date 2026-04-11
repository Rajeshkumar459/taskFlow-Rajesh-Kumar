import { useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import { ApiError } from '../api/client'
import { createProject } from '../api/projects'
import type { Project } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (project: Project) => void
}

export default function CreateProjectDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleClose = () => {
    setName('')
    setDescription('')
    setError('')
    onClose()
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const project = await createProject(name.trim(), description.trim() || undefined)
      onCreated(project)
      handleClose()
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.fields?.name ?? err.message)
      } else {
        setError('Failed to create project')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>New Project</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          label="Project Name"
          fullWidth
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          sx={{ mb: 2 }}
        />
        <TextField
          label="Description (optional)"
          fullWidth
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
