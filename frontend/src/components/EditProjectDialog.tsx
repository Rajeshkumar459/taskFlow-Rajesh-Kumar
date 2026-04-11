import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import { updateProject } from '../api/projects'
import { ApiError } from '../api/client'
import type { Project } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (project: Project) => void
  project: Project
}

export default function EditProjectDialog({ open, onClose, onSaved, project }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (open) {
      setName(project.name)
      setDescription(project.description ?? '')
      setError('')
      setNameError('')
    }
  }, [open, project])

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('Name is required')
      return
    }
    setLoading(true)
    setError('')
    setNameError('')
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onSaved(updated)
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields?.name) setNameError(err.fields.name)
        else setError(err.message)
      } else {
        setError('Failed to update project')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSave()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Project</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            autoFocus
            label="Project Name"
            required
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            error={!!nameError}
            helperText={nameError}
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}>
          {loading ? 'Saving…' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
