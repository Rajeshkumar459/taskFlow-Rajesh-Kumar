import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import { alpha } from '@mui/material/styles'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import { getProject, deleteProject } from '../api/projects'
import { getTasks, updateTask, deleteTask } from '../api/tasks'
import { getUsers } from '../api/users'
import { ApiError } from '../api/client'
import { useProjectSSE } from '../hooks/useProjectSSE'
import type { Task, Project, User, TaskStatus, ProjectMember } from '../types'
import TaskStatusChip from '../components/TaskStatusChip'
import TaskDialog from '../components/TaskDialog'
import FilterBar from '../components/FilterBar'
import MemberManagementDialog from '../components/MemberManagementDialog'
import EditProjectDialog from '../components/EditProjectDialog'
import KanbanBoard from '../components/KanbanBoard'
import { useAuth } from '../contexts/AuthContext'

const PRIORITY_STYLE: Record<string, { color: string; label: string }> = {
  low:    { color: '#64748b', label: 'Low'    },
  medium: { color: '#f59e0b', label: 'Medium' },
  high:   { color: '#ef4444', label: 'High'   },
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
    if (pDiff !== 0) return pDiff
    if (!a.due_date && !b.due_date) return 0
    if (!a.due_date) return 1
    if (!b.due_date) return -1
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  })
}

function getDueDateStatus(dueDate: string | undefined, status: TaskStatus): 'overdue' | 'due-soon' | 'normal' | null {
  if (!dueDate || status === 'done') return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'due-soon'
  return 'normal'
}

type ViewMode = 'list' | 'kanban'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus | undefined>()
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadProject = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const [data, users] = await Promise.all([getProject(id), getUsers()])
      setProject(data.project)
      setTasks(data.tasks)
      setMembers(data.members ?? [])
      setAllUsers(users)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadProject() }, [loadProject])

  useProjectSSE(id, {
    onTaskCreated:   (task) => setTasks((prev) => prev.find((t) => t.id === task.id) ? prev : [...prev, task]),
    onTaskUpdated:   (task) => setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t))),
    onTaskDeleted:   (taskId) => setTasks((prev) => prev.filter((t) => t.id !== taskId)),
    onMemberAdded:   (m) => setMembers((prev) => prev.find((x) => x.user_id === m.user_id) ? prev : [...prev, m]),
    onMemberUpdated: (m) => setMembers((prev) => prev.map((x) => (x.user_id === m.user_id ? m : x))),
    onMemberRemoved: (userId) => setMembers((prev) => prev.filter((m) => m.user_id !== userId)),
  })

  // Re-fetch filtered tasks when filters change (list view)
  const applyFilters = useCallback(async () => {
    if (!id) return
    try {
      const filtered = await getTasks(id, {
        status: statusFilter || undefined,
        assignee: assigneeFilter || undefined,
      })
      setTasks(filtered)
    } catch { /* retain current */ }
  }, [id, statusFilter, assigneeFilter])

  useEffect(() => {
    if (!loading) applyFilters()
  }, [statusFilter, assigneeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTaskSaved = (saved: Task) => {
    setTasks((ts) => {
      const idx = ts.findIndex((t) => t.id === saved.id)
      if (idx >= 0) { const c = [...ts]; c[idx] = saved; return c }
      return [...ts, saved]
    })
  }

  const handleDeleteTask = async (task: Task) => {
    if (!confirm(`Delete task "${task.title}"?`)) return
    try {
      await deleteTask(task.id)
      setTasks((ts) => ts.filter((t) => t.id !== task.id))
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
    }
  }

  const nextStatus = (current: TaskStatus): TaskStatus => {
    const cycle: TaskStatus[] = ['todo', 'in_progress', 'done']
    return cycle[(cycle.indexOf(current) + 1) % cycle.length]
  }

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    const prev = tasks
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)))
    try {
      const updated = await updateTask(task.id, { status: newStatus })
      setTasks((ts) => ts.map((t) => (t.id === updated.id ? updated : t)))
    } catch {
      setTasks(prev)
    }
  }

  const handleDeleteProject = async () => {
    if (!id) return
    setDeleting(true)
    try {
      await deleteProject(id)
      navigate('/projects')
    } catch (err) {
      setDeleteConfirmOpen(false)
      setError(err instanceof ApiError ? err.message : 'Failed to delete project')
    } finally {
      setDeleting(false)
    }
  }

  const openCreateTask = (ds?: TaskStatus) => {
    setEditingTask(null)
    setDefaultStatus(ds)
    setTaskDialogOpen(true)
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setDefaultStatus(undefined)
    setTaskDialogOpen(true)
  }

  const myMembership = members.find((m) => m.user_id === currentUser?.id)
  const isAdmin = myMembership?.role === 'admin'

  const userById = new Map<string, string>(allUsers.map((u) => [u.id, u.name]))

  const projectMembersAsUsers: User[] = members.map((m) => ({
    id: m.user_id,
    name: m.name,
    email: m.email,
  }))

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width="40%" height={48} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="60%" height={24} sx={{ mb: 3 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={72} sx={{ mb: 1 }} />
        ))}
      </Box>
    )
  }

  if (error && !project) {
    return <Alert severity="error">{error}</Alert>
  }

  return (
    <Box>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        {/* Row 1: Back + title + admin icons */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 0.5 }}>
          <IconButton onClick={() => navigate('/projects')} size="small" sx={{ mt: 0.4, flexShrink: 0 }}>
            <ArrowBackIcon />
          </IconButton>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
              <Typography variant="h5" fontWeight={700}
                sx={{ wordBreak: 'break-word', lineHeight: 1.3, mr: 0.5 }}>
                {project?.name}
              </Typography>
              {isAdmin && (
                <>
                  <Tooltip title="Edit project" arrow>
                    <IconButton size="small" onClick={() => setEditProjectOpen(true)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete project" arrow>
                    <IconButton size="small" color="error" onClick={() => setDeleteConfirmOpen(true)}>
                      <DeleteForeverIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
            </Box>
            {project?.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {project.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {members.length} member{members.length !== 1 ? 's' : ''}
              </Typography>
              {isAdmin && (
                <Button
                  size="small"
                  startIcon={<PeopleOutlineIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => setMemberDialogOpen(true)}
                  sx={{ fontSize: '0.75rem', minWidth: 0, px: 1, py: 0.25 }}
                >
                  Manage
                </Button>
              )}
            </Box>
          </Box>
        </Box>

        {/* Row 2: View toggle (right-aligned) + Add Task */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: { xs: 0, sm: '44px' }, mt: { xs: 1.5, sm: 1 } }}>
          <Box sx={{ flex: 1 }} />

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => { if (v) setViewMode(v) }}
            size="small"
          >
            <ToggleButton value="list" aria-label="List view">
              <Tooltip title="List view" arrow>
                <ViewListIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="kanban" aria-label="Kanban view">
              <Tooltip title="Kanban view" arrow>
                <ViewKanbanIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            size="small"
            onClick={() => openCreateTask()}
          >
            Add Task
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 3 }}>
        <FilterBar
          statusFilter={viewMode === 'kanban' ? '' : statusFilter}
          assigneeFilter={assigneeFilter}
          projectMembers={projectMembersAsUsers}
          onStatusChange={(v) => { if (viewMode === 'list') setStatusFilter(v) }}
          onAssigneeChange={setAssigneeFilter}
          onClear={() => { setStatusFilter(''); setAssigneeFilter('') }}
          hideStatus={viewMode === 'kanban'}
        />
      </Box>

      {/* ── Content ────────────────────────────────────────────────────── */}
      {viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={sortTasks(tasks)}
          userById={userById}
          isAdmin={isAdmin}
          onTaskSaved={handleTaskSaved}
          onDeleteTask={handleDeleteTask}
          onOpenCreateTask={openCreateTask}
          onOpenEditTask={openEditTask}
        />
      ) : (
        /* List view */
        tasks.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <AssignmentIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No tasks yet
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
              {statusFilter || assigneeFilter
                ? 'No tasks match the current filters.'
                : 'Add your first task to get started.'}
            </Typography>
            {!statusFilter && !assigneeFilter && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreateTask()}>
                Add Task
              </Button>
            )}
          </Box>
        ) : (
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            {sortTasks(tasks).map((task, idx) => (
              <Box key={task.id}>
                {idx > 0 && <Divider />}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: { xs: 1.5, sm: 2 },
                    px: { xs: 2, sm: 3 },
                    py: { xs: 1.5, sm: 2 },
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {/* Status chip — stays left on all sizes */}
                  <Tooltip title="Click to advance status" arrow>
                    <span style={{ flexShrink: 0, paddingTop: 2 }}>
                      <TaskStatusChip
                        status={task.status}
                        onClick={() => handleStatusChange(task, nextStatus(task.status))}
                      />
                    </span>
                  </Tooltip>

                  {/* Main content: title + meta */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body1"
                      fontWeight={500}
                      sx={{
                        ...(task.status === 'done'
                          ? { textDecoration: 'line-through', color: 'text.disabled' }
                          : {}),
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: { xs: 'normal', sm: 'nowrap' },
                        wordBreak: 'break-word',
                      }}
                    >
                      {task.title}
                    </Typography>
                    {task.description && (
                      <Typography variant="caption" color="text.secondary"
                        sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.description}
                      </Typography>
                    )}
                    {/* Inline meta row — due date + assignee (priority moved to right) */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5, alignItems: 'center' }}>
                      {/* Priority chip — only shown on xs (on sm+ it's in the right column) */}
                      {(() => {
                        const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.medium
                        return (
                          <Chip
                            label={ps.label}
                            size="small"
                            sx={{
                              display: { xs: 'inline-flex', sm: 'none' },
                              height: 20,
                              bgcolor: alpha(ps.color, 0.1),
                              color: ps.color,
                              border: `1px solid ${alpha(ps.color, 0.3)}`,
                              fontWeight: 600,
                              fontSize: '0.68rem',
                              '.MuiChip-label': { px: 1 },
                            }}
                          />
                        )
                      })()}
                      {task.due_date && (() => {
                        const ds = getDueDateStatus(task.due_date, task.status)
                        const color = ds === 'overdue' ? 'error.main' : ds === 'due-soon' ? 'warning.main' : 'text.disabled'
                        return (
                          <Tooltip title={ds === 'overdue' ? 'Overdue' : ds === 'due-soon' ? 'Due soon' : ''} arrow>
                            <Typography variant="caption" sx={{ color, fontWeight: ds && ds !== 'normal' ? 600 : 400 }}>
                              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </Typography>
                          </Tooltip>
                        )
                      })()}
                      {task.assignee_id && (
                        <Typography variant="caption" color="text.secondary">
                          {userById.get(task.assignee_id) ?? '—'}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Priority chip — right-aligned, visible on sm+ only */}
                  {(() => {
                    const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.medium
                    return (
                      <Chip
                        label={ps.label}
                        size="small"
                        sx={{
                          display: { xs: 'none', sm: 'inline-flex' },
                          height: 22,
                          bgcolor: alpha(ps.color, 0.1),
                          color: ps.color,
                          border: `1px solid ${alpha(ps.color, 0.3)}`,
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          flexShrink: 0,
                          '.MuiChip-label': { px: 1 },
                        }}
                      />
                    )
                  })()}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <Tooltip title="Edit" arrow>
                      <IconButton size="small" onClick={() => openEditTask(task)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip title="Delete" arrow>
                        <IconButton size="small" color="error" onClick={() => handleDeleteTask(task)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Paper>
        )
      )}

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      <TaskDialog
        open={taskDialogOpen}
        onClose={() => setTaskDialogOpen(false)}
        onSaved={handleTaskSaved}
        projectId={id!}
        task={editingTask}
        projectMembers={projectMembersAsUsers}
        defaultStatus={defaultStatus}
      />

      {isAdmin && project && (
        <EditProjectDialog
          open={editProjectOpen}
          onClose={() => setEditProjectOpen(false)}
          onSaved={(updated) => setProject(updated)}
          project={project}
        />
      )}

      {isAdmin && (
        <MemberManagementDialog
          open={memberDialogOpen}
          onClose={() => setMemberDialogOpen(false)}
          projectId={id!}
          members={members}
          allUsers={allUsers}
          currentUserId={currentUser?.id ?? ''}
          onMembersChanged={setMembers}
        />
      )}

      {/* Delete project confirmation */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => !deleting && setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete project?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Permanently delete <strong>{project?.name}</strong> and all its tasks? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteProject}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete Project'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
