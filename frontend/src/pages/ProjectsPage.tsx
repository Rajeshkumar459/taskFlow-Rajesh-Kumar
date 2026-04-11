import { useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import AddIcon from '@mui/icons-material/Add'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { getProjects } from '../api/projects'
import { ApiError } from '../api/client'
import type { Project } from '../types'
import ProjectCard from '../components/ProjectCard'
import CreateProjectDialog from '../components/CreateProjectDialog'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Failed to load projects')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleProjectCreated = (project: Project) => {
    setProjects((prev) => [project, ...prev])
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" fontWeight={600} sx={{ flex: 1 }}>
          Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          New Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={3}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined">
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="90%" />
                  <Skeleton variant="text" width="40%" />
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
            borderRadius: 2,
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
              <ProjectCard project={project} />
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
