import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ViewListIcon from '@mui/icons-material/ViewList'
import ViewKanbanIcon from '@mui/icons-material/ViewKanban'
import { getProject } from '../api/projects'
import { getTasks, updateTask, deleteTask } from '../api/tasks'
import { getUsers } from '../api/users'
import { ApiError } from '../api/client'
import type { Task, Project, User, TaskStatus, ProjectMember } from '../types'
import TaskStatusChip from '../components/TaskStatusChip'
import TaskDialog from '../components/TaskDialog'
import FilterBar from '../components/FilterBar'
import MemberManagementDialog from '../components/MemberManagementDialog'
import EditProjectDialog from '../components/EditProjectDialog'
import KanbanBoard from '../components/KanbanBoard'
import { useAuth } from '../contexts/AuthContext'

const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8080'
const TOKEN_KEY = 'taskflow_token'

const PRIORITY_COLORS: Record<string, 'default' | 'warning' | 'error'> = {
  low: 'default',
  medium: 'warning',
  high: 'error',
}

type ViewMode = 'list' | 'kanban'

type SSEEvent =
  | { type: 'task_created'; payload: Task }
  | { type: 'task_updated'; payload: Task }
  | { type: 'task_deleted'; payload: { task_id: string } }
  | { type: 'member_added'; payload: ProjectMember }
  | { type: 'member_updated'; payload: ProjectMember }
  | { type: 'member_removed'; payload: { user_id: string } }
  | { type: 'connected' }

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

  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus | undefined>()
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)

  const esRef = useRef<EventSource | null>(null)

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

  // SSE subscription
  useEffect(() => {
    if (!id) return
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return

    const url = `${BASE_URL}/projects/${id}/events?token=${encodeURIComponent(token)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data) as SSEEvent
        switch (msg.type) {
          case 'task_created':
            setTasks((prev) =>
              prev.find((t) => t.id === msg.payload.id) ? prev : [...prev, msg.payload]
            )
            break
          case 'task_updated':
            setTasks((prev) => prev.map((t) => (t.id === msg.payload.id ? msg.payload : t)))
            break
          case 'task_deleted':
            setTasks((prev) => prev.filter((t) => t.id !== msg.payload.task_id))
            break
          case 'member_added':
            setMembers((prev) =>
              prev.find((m) => m.user_id === msg.payload.user_id) ? prev : [...prev, msg.payload]
            )
            break
          case 'member_updated':
            setMembers((prev) =>
              prev.map((m) => (m.user_id === msg.payload.user_id ? msg.payload : m))
            )
            break
          case 'member_removed':
            setMembers((prev) => prev.filter((m) => m.user_id !== msg.payload.user_id))
            break
        }
      } catch { /* ignore malformed */ }
    }

    return () => { es.close(); esRef.current = null }
  }, [id])

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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/projects')} size="small" sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h4" fontWeight={600} noWrap>
              {project?.name}
            </Typography>
            {isAdmin && (
              <Tooltip title="Edit project">
                <IconButton size="small" onClick={() => setEditProjectOpen(true)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {project?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {project.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Typography>
            {isAdmin && (
              <Button
                size="small"
                startIcon={<PeopleOutlineIcon />}
                onClick={() => setMemberDialogOpen(true)}
                sx={{ textTransform: 'none', fontSize: '0.75rem', minWidth: 0 }}
              >
                Manage
              </Button>
            )}
          </Box>
        </Box>

        {/* View toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => { if (v) setViewMode(v) }}
          size="small"
          sx={{ alignSelf: 'center' }}
        >
          <ToggleButton value="list" aria-label="List view">
            <Tooltip title="List view">
              <ViewListIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="kanban" aria-label="Kanban view">
            <Tooltip title="Kanban view">
              <ViewKanbanIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => openCreateTask()}
        >
          Add Task
        </Button>
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
          tasks={tasks}
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
            {tasks.map((task, idx) => (
              <Box key={task.id}>
                {idx > 0 && <Divider />}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 3,
                    py: 2,
                    flexWrap: 'wrap',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Tooltip title="Click to advance status">
                    <span>
                      <TaskStatusChip
                        status={task.status}
                        onClick={() => handleStatusChange(task, nextStatus(task.status))}
                      />
                    </span>
                  </Tooltip>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body1"
                      fontWeight={500}
                      noWrap
                      sx={task.status === 'done'
                        ? { textDecoration: 'line-through', color: 'text.disabled' }
                        : {}}
                    >
                      {task.title}
                    </Typography>
                    {task.description && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {task.description}
                      </Typography>
                    )}
                    {task.assignee_id && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Assigned to: {userById.get(task.assignee_id) ?? task.assignee_id}
                      </Typography>
                    )}
                  </Box>

                  <Chip
                    label={task.priority}
                    size="small"
                    color={PRIORITY_COLORS[task.priority]}
                    variant="outlined"
                    sx={{ textTransform: 'capitalize' }}
                  />

                  {task.due_date && (
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
                      {new Date(task.due_date).toLocaleDateString()}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditTask(task)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {isAdmin && (
                      <Tooltip title="Delete">
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
    </Box>
  )
}
