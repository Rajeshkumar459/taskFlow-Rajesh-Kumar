import { useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Avatar from '@mui/material/Avatar'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import AddIcon from '@mui/icons-material/Add'
import { updateTask } from '../api/tasks'
import type { Task, TaskStatus } from '../types'

// ─── Column configuration ────────────────────────────────────────────────────

const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done']

interface ColumnConfig {
  id: TaskStatus
  label: string
  icon: React.ReactNode
  accentColor: string
  bgColor: string
  emptyLabel: string
}

const COLUMN_CONFIG: ColumnConfig[] = [
  {
    id: 'todo',
    label: 'To Do',
    icon: <RadioButtonUncheckedIcon fontSize="small" />,
    accentColor: '#757575',
    bgColor: '#f8f8f8',
    emptyLabel: 'Nothing here yet',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    icon: <AccessTimeIcon fontSize="small" />,
    accentColor: '#1976d2',
    bgColor: '#f0f7ff',
    emptyLabel: 'Drag tasks here to start',
  },
  {
    id: 'done',
    label: 'Done',
    icon: <CheckCircleIcon fontSize="small" />,
    accentColor: '#2e7d32',
    bgColor: '#f1faf3',
    emptyLabel: 'Completed tasks appear here',
  },
]

const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  low:    { bg: '#f5f5f5', color: '#757575', label: 'Low' },
  medium: { bg: '#fff8e1', color: '#f57c00', label: 'Medium' },
  high:   { bg: '#ffeaea', color: '#c62828', label: 'High' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDueDateStatus(dueDate: string | undefined, status: TaskStatus): 'overdue' | 'due-soon' | 'normal' | null {
  if (!dueDate || status === 'done') return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const diffDays = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'due-soon'
  return 'normal'
}

function distributeByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const result: Record<TaskStatus, Task[]> = { todo: [], in_progress: [], done: [] }
  for (const task of tasks) {
    result[task.status]?.push(task)
  }
  return result
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Simple deterministic color from string
function avatarColor(str: string): string {
  const colors = ['#1976d2', '#388e3c', '#7b1fa2', '#d32f2f', '#f57c00', '#0097a7']
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

// ─── Task card (shared between sortable and DragOverlay) ─────────────────────

interface TaskCardProps {
  task: Task
  userById: Map<string, string>
  isAdmin: boolean
  isDragging?: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onAddTask?: () => void
}

function TaskCardContent({ task, userById, isAdmin, isDragging, onEdit, onDelete }: TaskCardProps) {
  const p = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.medium
  const assigneeName = task.assignee_id ? userById.get(task.assignee_id) : undefined

  return (
    <Paper
      elevation={isDragging ? 8 : 1}
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'background.paper',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        transition: 'box-shadow 0.15s, transform 0.1s',
        transform: isDragging ? 'rotate(2deg) scale(1.02)' : 'none',
        '&:hover': isDragging ? {} : {
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        },
        '& .card-actions': { opacity: 0, transition: 'opacity 0.15s' },
        '&:hover .card-actions': { opacity: 1 },
        '& .drag-icon': { opacity: 0, transition: 'opacity 0.15s' },
        '&:hover .drag-icon': { opacity: 1 },
      }}
    >
      {/* Top row: priority + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
        <Box
          component="span"
          sx={{
            px: 0.75,
            py: 0.25,
            borderRadius: 1,
            bgcolor: p.bg,
            color: p.color,
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: 0.3,
          }}
        >
          {p.label.toUpperCase()}
        </Box>

        <Box sx={{ flex: 1 }} />

        <DragIndicatorIcon
          className="drag-icon"
          sx={{ fontSize: 16, color: 'text.disabled', mr: 0.5 }}
        />

        <Box className="card-actions" sx={{ display: 'flex', gap: 0 }}>
          <Tooltip title="Edit task">
            <IconButton
              size="small"
              sx={{ p: 0.4 }}
              onClick={(e) => { e.stopPropagation(); onEdit(task) }}
            >
              <EditOutlinedIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Delete task">
              <IconButton
                size="small"
                color="error"
                sx={{ p: 0.4 }}
                onClick={(e) => { e.stopPropagation(); onDelete(task) }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Title */}
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{
          lineHeight: 1.35,
          mb: task.description ? 0.5 : 0.75,
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
          color: task.status === 'done' ? 'text.disabled' : 'text.primary',
        }}
      >
        {task.title}
      </Typography>

      {/* Description */}
      {task.description && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            mb: 0.75,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.description}
        </Typography>
      )}

      {/* Bottom row: assignee + due date */}
      {(assigneeName || task.due_date) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
          {assigneeName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  fontSize: '0.6rem',
                  bgcolor: avatarColor(assigneeName),
                }}
              >
                {getInitials(assigneeName)}
              </Avatar>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 80 }}>
                {assigneeName}
              </Typography>
            </Box>
          )}
          {task.due_date && (() => {
            const ds = getDueDateStatus(task.due_date, task.status)
            const color = ds === 'overdue' ? 'error.main' : ds === 'due-soon' ? 'warning.main' : 'text.disabled'
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, ml: 'auto' }}>
                <CalendarTodayIcon sx={{ fontSize: 11, color }} />
                <Typography variant="caption" sx={{ color, fontWeight: ds && ds !== 'normal' ? 600 : 400 }}>
                  {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Typography>
              </Box>
            )
          })()}
        </Box>
      )}
    </Paper>
  )
}

// ─── Sortable card wrapper ────────────────────────────────────────────────────

function SortableTaskCard(props: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
  })

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      sx={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <TaskCardContent {...props} />
    </Box>
  )
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColumnProps {
  config: ColumnConfig
  tasks: Task[]
  isOver: boolean
  userById: Map<string, string>
  isAdmin: boolean
  onEdit: (task: Task) => void
  onDelete: (task: Task) => void
  onAddTask: () => void
}

function KanbanColumn({ config, tasks, isOver, userById, isAdmin, onEdit, onDelete, onAddTask }: ColumnProps) {
  const { setNodeRef, isOver: droppableOver } = useDroppable({ id: config.id })
  const highlighting = isOver || droppableOver

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderRadius: 3,
        overflow: 'hidden',
        bgcolor: highlighting ? `${config.accentColor}14` : config.bgColor,
        border: '2px solid',
        borderColor: highlighting ? config.accentColor : 'transparent',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* Column header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ color: config.accentColor, display: 'flex', alignItems: 'center' }}>
          {config.icon}
        </Box>
        <Typography variant="subtitle2" fontWeight={700} sx={{ color: config.accentColor, flex: 1 }}>
          {config.label}
        </Typography>
        <Chip
          label={tasks.length}
          size="small"
          sx={{
            height: 20,
            minWidth: 24,
            fontSize: '0.7rem',
            fontWeight: 700,
            bgcolor: `${config.accentColor}18`,
            color: config.accentColor,
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      </Box>

      {/* Task list */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1,
          overflowY: 'auto',
          p: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          minHeight: 120,
          maxHeight: 'calc(100vh - 320px)',
        }}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              userById={userById}
              isAdmin={isAdmin}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 3,
              borderRadius: 2,
              border: '2px dashed',
              borderColor: highlighting ? config.accentColor : 'divider',
              transition: 'border-color 0.15s',
            }}
          >
            <Typography variant="caption" color="text.disabled" textAlign="center">
              {highlighting ? 'Drop here' : config.emptyLabel}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Add task footer */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Box
          component="button"
          onClick={onAddTask}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            width: '100%',
            border: 'none',
            bgcolor: 'transparent',
            cursor: 'pointer',
            borderRadius: 1.5,
            px: 1,
            py: 0.75,
            color: 'text.disabled',
            fontSize: '0.8rem',
            transition: 'color 0.15s, background-color 0.15s',
            '&:hover': {
              color: config.accentColor,
              bgcolor: `${config.accentColor}10`,
            },
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
          Add task
        </Box>
      </Box>
    </Box>
  )
}

// ─── KanbanBoard (main export) ───────────────────────────────────────────────

interface KanbanBoardProps {
  tasks: Task[]
  userById: Map<string, string>
  isAdmin: boolean
  onTaskSaved: (task: Task) => void
  onDeleteTask: (task: Task) => void
  onOpenCreateTask: (defaultStatus?: TaskStatus) => void
  onOpenEditTask: (task: Task) => void
}

export default function KanbanBoard({
  tasks,
  userById,
  isAdmin,
  onTaskSaved,
  onDeleteTask,
  onOpenCreateTask,
  onOpenEditTask,
}: KanbanBoardProps) {
  const [columnTasks, setColumnTasks] = useState<Record<TaskStatus, Task[]>>(
    () => distributeByStatus(tasks)
  )
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null)

  const dragStartColumnRef = useRef<TaskStatus | null>(null)
  const isDraggingRef = useRef(false)

  // Sync from parent (e.g. SSE events) — only when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setColumnTasks(distributeByStatus(tasks))
    }
  }, [tasks])

  const getColumn = useCallback(
    (id: UniqueIdentifier): TaskStatus | null => {
      if (STATUSES.includes(id as TaskStatus)) return id as TaskStatus
      for (const s of STATUSES) {
        if (columnTasks[s].some((t) => t.id === id)) return s
      }
      return null
    },
    [columnTasks]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragStart = ({ active }: DragStartEvent) => {
    const col = getColumn(active.id)
    dragStartColumnRef.current = col
    isDraggingRef.current = true

    const task = col ? columnTasks[col].find((t) => t.id === active.id) ?? null : null
    setActiveTask(task)
  }

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) { setOverColumn(null); return }

    const fromCol = getColumn(active.id)
    const toCol = getColumn(over.id)

    setOverColumn(toCol)

    if (!fromCol || !toCol || fromCol === toCol) return

    setColumnTasks((prev) => {
      const fromItems = prev[fromCol]
      const toItems = prev[toCol]
      const activeIdx = fromItems.findIndex((t) => t.id === active.id)
      const overIdx = toItems.findIndex((t) => t.id === over.id)

      const movedTask = { ...fromItems[activeIdx], status: toCol }
      const insertAt = overIdx === -1 ? toItems.length : overIdx

      return {
        ...prev,
        [fromCol]: fromItems.filter((t) => t.id !== active.id),
        [toCol]: [
          ...toItems.slice(0, insertAt),
          movedTask,
          ...toItems.slice(insertAt),
        ],
      }
    })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    isDraggingRef.current = false
    setActiveTask(null)
    setOverColumn(null)

    if (!over) {
      // Dropped outside — revert to last known-good state from tasks prop
      setColumnTasks(distributeByStatus(tasks))
      dragStartColumnRef.current = null
      return
    }

    const finalCol = getColumn(active.id)
    const startCol = dragStartColumnRef.current
    dragStartColumnRef.current = null

    if (!finalCol) return

    // Within-column reorder
    const overCol = getColumn(over.id)
    if (overCol === finalCol && active.id !== over.id) {
      setColumnTasks((prev) => {
        const items = prev[finalCol]
        const aIdx = items.findIndex((t) => t.id === active.id)
        const oIdx = items.findIndex((t) => t.id === over.id)
        if (aIdx === -1 || oIdx === -1) return prev
        return { ...prev, [finalCol]: arrayMove(items, aIdx, oIdx) }
      })
    }

    // Persist status change via API
    if (startCol && startCol !== finalCol) {
      const task = columnTasks[finalCol].find((t) => t.id === active.id)
      if (!task) return

      const savedStartCol = startCol
      const savedFinalCol = finalCol

      updateTask(task.id, { status: finalCol }).then((updated) => {
        onTaskSaved(updated)
      }).catch(() => {
        // Revert the moved card back to its original column
        setColumnTasks((prev) => {
          const taskToRevert = prev[savedFinalCol]?.find((t) => t.id === active.id)
          if (!taskToRevert) return prev
          return {
            ...prev,
            [savedFinalCol]: prev[savedFinalCol].filter((t) => t.id !== active.id),
            [savedStartCol]: [
              ...prev[savedStartCol],
              { ...taskToRevert, status: savedStartCol },
            ],
          }
        })
      })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 2,
          alignItems: 'start',
        }}
      >
        {COLUMN_CONFIG.map((col) => (
          <KanbanColumn
            key={col.id}
            config={col}
            tasks={columnTasks[col.id]}
            isOver={overColumn === col.id}
            userById={userById}
            isAdmin={isAdmin}
            onEdit={onOpenEditTask}
            onDelete={onDeleteTask}
            onAddTask={() => onOpenCreateTask(col.id)}
          />
        ))}
      </Box>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeTask ? (
          <TaskCardContent
            task={activeTask}
            userById={userById}
            isAdmin={isAdmin}
            isDragging
            onEdit={onOpenEditTask}
            onDelete={onDeleteTask}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
