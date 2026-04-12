import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import AddIcon from '@mui/icons-material/Add'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import FolderIcon from '@mui/icons-material/Folder'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { getProjects, getProjectStats } from '../api/projects'
import { ApiError } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import type { Project, TaskCounts } from '../types'
import ProjectCard from '../components/ProjectCard'
import CreateProjectDialog from '../components/CreateProjectDialog'

// ─── Greeting ────────────────────────────────────────────────────────────────

function greeting(name: string): string {
  const h = new Date().getHours()
  const salutation =
    h >= 5 && h < 12 ? 'Good morning' :
    h >= 12 && h < 17 ? 'Good afternoon' :
    h >= 17 && h < 21 ? 'Good evening' :
    'Good night'
  return `${salutation}, ${name.split(' ')[0]}`
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number | null   // null = loading
  icon: React.ReactNode
  accentColor: string
  bgColor: string
}

function StatCard({ label, value, icon, accentColor, bgColor }: StatCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: bgColor,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${accentColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          bgcolor: `${accentColor}18`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: accentColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        {value === null ? (
          <Skeleton variant="text" width={40} height={36} />
        ) : (
          <Typography variant="h4" fontWeight={700} lineHeight={1} color={accentColor}>
            {value}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" fontWeight={500} sx={{ mt: 0.25 }}>
          {label}
        </Typography>
      </Box>
    </Paper>
  )
}

const STATS_CONFIG: Omit<StatCardProps, 'value'>[] = [
  {
    label: 'Projects',
    icon: <FolderIcon />,
    accentColor: '#1976d2',
    bgColor: '#f0f7ff',
  },
  {
    label: 'To Do',
    icon: <RadioButtonUncheckedIcon />,
    accentColor: '#616161',
    bgColor: '#f8f8f8',
  },
  {
    label: 'In Progress',
    icon: <AccessTimeIcon />,
    accentColor: '#ed6c02',
    bgColor: '#fff8f0',
  },
  {
    label: 'Done',
    icon: <CheckCircleIcon />,
    accentColor: '#2e7d32',
    bgColor: '#f1faf3',
  },
  {
    label: 'Overdue',
    icon: <WarningAmberIcon />,
    accentColor: '#c62828',
    bgColor: '#fff5f5',
  },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { user } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  // Per-project task counts, loaded asynchronously after projects
  const [taskCountsMap, setTaskCountsMap] = useState<Record<string, TaskCounts>>({})
  const [statsLoading, setStatsLoading] = useState(false)

  // Aggregate totals
  const totals = Object.values(taskCountsMap).reduce(
    (acc, c) => ({
      todo:        acc.todo + c.todo,
      in_progress: acc.in_progress + c.in_progress,
      done:        acc.done + c.done,
      overdue:     acc.overdue + c.overdue,
    }),
    { todo: 0, in_progress: 0, done: 0, overdue: 0 }
  )

  const loadProjects = useCallback(async () => {
    setLoadingProjects(true)
    setError('')
    try {
      const data = await getProjects()
      setProjects(data)
      return data
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load projects')
      return []
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  const loadStats = useCallback(async (projectList: Project[]) => {
    if (projectList.length === 0) return
    setStatsLoading(true)
    try {
      const results = await Promise.allSettled(
        projectList.map((p) => getProjectStats(p.id))
      )
      const map: Record<string, TaskCounts> = {}
      results.forEach((result, i) => {
        // Guard: result.value can be undefined (204) or have null by_status (empty project)
        if (result.status !== 'fulfilled' || result.value == null) return
        const s = result.value
        const counts: TaskCounts = { todo: 0, in_progress: 0, done: 0, total: 0, overdue: 0 }
        for (const sc of (s.by_status ?? [])) {
          if (sc.status === 'todo') counts.todo = sc.count
          else if (sc.status === 'in_progress') counts.in_progress = sc.count
          else if (sc.status === 'done') counts.done = sc.count
        }
        counts.total = counts.todo + counts.in_progress + counts.done
        counts.overdue = s.overdue_count ?? 0
        map[projectList[i].id] = counts
      })
      setTaskCountsMap(map)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects().then(loadStats)
  }, [loadProjects, loadStats])

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev])
    // New project has no tasks yet
    setTaskCountsMap((prev) => ({
      ...prev,
      [project.id]: { todo: 0, in_progress: 0, done: 0, total: 0, overdue: 0 },
    }))
  }

  const statValues: (number | null)[] = [
    loadingProjects ? null : projects.length,
    statsLoading    ? null : totals.todo,
    statsLoading    ? null : totals.in_progress,
    statsLoading    ? null : totals.done,
    statsLoading    ? null : totals.overdue,
  ]

  return (
    <Box>
      {/* ── Greeting ───────────────────────────────────────────────────── */}
      {user && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700}>
            {greeting(user.name)}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
            Here's what's happening across your projects.
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 5 }}>
        {STATS_CONFIG.map((cfg, i) => (
          <Grid key={cfg.label} size={{ xs: 6, sm: 4, md: 'auto' }} sx={{ flex: { md: 1 } }}>
            <StatCard {...cfg} value={statValues[i]} />
          </Grid>
        ))}
      </Grid>

      {/* ── Projects section ───────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Typography variant="h5" fontWeight={600} sx={{ flex: 1 }}>
          Your Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          New Project
        </Button>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {loadingProjects ? (
        <Grid container spacing={3}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} sx={{ mb: 0.5 }} />
                  <Skeleton variant="text" width="90%" />
                  <Skeleton variant="text" width="75%" />
                  <Skeleton variant="rectangular" height={6} sx={{ mt: 2, mb: 1, borderRadius: 1 }} />
                  <Skeleton variant="text" width="50%" />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : projects.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 10,
            px: 2,
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <FolderOpenIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No projects yet
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
            Create your first project to start tracking tasks.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Create Project
          </Button>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard
                project={project}
                taskCounts={taskCountsMap[project.id]}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleProjectCreated}
      />
    </Box>
  )
}
