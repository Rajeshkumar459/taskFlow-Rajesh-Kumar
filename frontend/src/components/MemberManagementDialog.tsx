import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { addMember, updateMemberRole, removeMember } from '../api/members'
import { ApiError } from '../api/client'
import type { ProjectMember, User, MemberRole } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  members: ProjectMember[]
  allUsers: User[]
  currentUserId: string
  onMembersChanged: (members: ProjectMember[]) => void
}

export default function MemberManagementDialog({
  open,
  onClose,
  projectId,
  members,
  allUsers,
  currentUserId,
  onMembersChanged,
}: Props) {
  const [localMembers, setLocalMembers] = useState<ProjectMember[]>(members)
  const [error, setError] = useState('')

  // Picker state for adding a new member
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<MemberRole>('member')
  const [adding, setAdding] = useState(false)

  // Sync when dialog re-opens with fresh members
  useEffect(() => {
    if (open) {
      setLocalMembers(members)
      setError('')
      setSelectedUser(null)
      setSelectedRole('member')
    }
  }, [open, members])

  const memberUserIds = new Set(localMembers.map((m) => m.user_id))
  const addableUsers = allUsers.filter((u) => !memberUserIds.has(u.id))

  const handleAdd = async () => {
    if (!selectedUser) return
    setAdding(true)
    setError('')
    try {
      const newMember = await addMember(projectId, selectedUser.id, selectedRole)
      const updated = [...localMembers, newMember]
      setLocalMembers(updated)
      onMembersChanged(updated)
      setSelectedUser(null)
      setSelectedRole('member')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add member')
    } finally {
      setAdding(false)
    }
  }

  const handleRoleChange = async (userId: string, role: MemberRole) => {
    setError('')
    try {
      const updated = await updateMemberRole(projectId, userId, role)
      const next = localMembers.map((m) => (m.user_id === userId ? updated : m))
      setLocalMembers(next)
      onMembersChanged(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role')
    }
  }

  const handleRemove = async (userId: string) => {
    setError('')
    try {
      await removeMember(projectId, userId)
      const next = localMembers.filter((m) => m.user_id !== userId)
      setLocalMembers(next)
      onMembersChanged(next)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove member')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Members</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Existing members */}
        {localMembers.map((member, idx) => (
          <Box key={member.user_id}>
            {idx > 0 && <Divider sx={{ my: 1 }} />}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" fontWeight={500}>
                  {member.name}
                  {member.user_id === currentUserId ? ' (you)' : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {member.email}
                </Typography>
              </Box>
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <Select
                  value={member.role}
                  onChange={(e) => handleRoleChange(member.user_id, e.target.value as MemberRole)}
                  disabled={member.user_id === currentUserId}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="member">Member</MenuItem>
                </Select>
              </FormControl>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleRemove(member.user_id)}
                disabled={member.user_id === currentUserId}
                title="Remove member"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        ))}

        {/* Add new member */}
        {addableUsers.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Add member
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Autocomplete
                options={addableUsers}
                getOptionLabel={(u) => `${u.name} (${u.email})`}
                value={selectedUser}
                onChange={(_, v) => setSelectedUser(v)}
                renderInput={(params) => (
                  <TextField {...params} label="User" size="small" />
                )}
                sx={{ flex: 1, minWidth: 200 }}
              />
              <FormControl size="small" sx={{ minWidth: 110 }}>
                <InputLabel>Role</InputLabel>
                <Select
                  value={selectedRole}
                  label="Role"
                  onChange={(e) => setSelectedRole(e.target.value as MemberRole)}
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="member">Member</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                onClick={handleAdd}
                disabled={!selectedUser || adding}
              >
                Add
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}
