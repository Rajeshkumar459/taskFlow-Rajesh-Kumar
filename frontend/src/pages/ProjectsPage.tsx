import { useState, useEffect, useCallback, useMemo } from 'react'
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
import { alpha, useTheme } from '@mui/material/styles'
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

function greeting(name: string): string {
  const h = new Date().getHours()
  const salutation =
    h >= 5 && h < 12 ? 'Good morning' :
    h >= 12 && h < 17 ? 'Good afternoon' :
    h >= 17 && h < 21 ? 'Good evening' :
    'Good night'
  return `${salutation}, ${name.split(' ')[0]}`
}

interface StatCardProps {
  label: string
  value: number | null
  icon: React.ReactNode
  accentColor: string
}

function StatCard({ label, value, icon, accentColor }: StatCardProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: isDark ? alpha(accentColor, 0.1) : alpha(accentColor, 0.07),
        border: '1px solid',
        borderColor: isDark ? alpha(accentColor, 0.2) : alpha(accentColor, 0.15),
        borderLeft: `4px solid ${accentColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        transition: 'transform 0.15s, box-shadow 0.15s',
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: `0 4px 16px ${alpha(accentColor, isDark ? 0.2 : 0.12)}`,
        },
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          bgcolor: alpha(accentColor, isDark ? 0.15 : 0.12),
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
          <Typography variant="h4" fontWeight={700} lineHeight={1} sx={{ color: accentColor }}>
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
  { label: 'Projects',    icon: <FolderIcon />,                accentColor: '#4f46e5' },
  { label: 'To Do',       icon: <RadioButtonUncheckedIcon />,  accentColor: '#64748b' },
  { label: 'In Progress', icon: <AccessTimeIcon />,            accentColor: '#f59e0b' },
  { label: 'Done',        icon: <CheckCircleIcon />,           accentColor: '#10b981' },
  { label: 'Overdue',     icon: <WarningAmberIcon />,          accentColor: '#ef4444' },
]

export default function ProjectsPage() {
  const { user } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const [taskCountsMap, setTaskCountsMap] = useState<Record<string, TaskCounts>>({})
  const [statsLoading, setStatsLoading] = useState(false)

  const totals = useMemo(
    () => Object.values(taskCountsMap).reduce(
      (acc, c) => ({
        todo:        acc.todo + c.todo,
        in_progress: acc.in_progress + c.in_progress,
        done:        acc.done + c.done,
        overdue:     acc.overdue + c.overdue,
      }),
      { todo: 0, in_progress: 0, done: 0, overdue: 0 }
    ),
    [taskCountsMap]
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

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 5 }}>
        {STATS_CONFIG.map((cfg, i) => (
          <Grid key={cfg.label} size={{ xs: 6, sm: 4, lg: 'grow' }}>
            <StatCard {...cfg} value={statValues[i]} />
          </Grid>
        ))}
      </Grid>

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
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}>
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
            py: { xs: 6, sm: 10 },
            px: 2,
            border: '1.5px dashed',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <FolderOpenIcon sx={{ fontSize: { xs: 48, sm: 64 }, color: 'text.disabled', mb: 2 }} />
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
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {projects.map((project) => (
            <Grid key={project.id} size={{ xs: 12, sm: 6, lg: 4 }}>
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
