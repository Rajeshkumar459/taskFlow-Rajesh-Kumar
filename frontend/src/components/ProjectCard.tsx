import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import FolderIcon from '@mui/icons-material/Folder'
import { useNavigate } from 'react-router-dom'
import type { Project } from '../types'

interface Props {
  project: Project
}

export default function ProjectCard({ project }: Props) {
  const navigate = useNavigate()

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: 3 },
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/projects/${project.id}`)}
        sx={{ height: '100%', alignItems: 'flex-start' }}
      >
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
            <FolderIcon color="primary" />
            <Typography variant="h6" component="div" noWrap>
              {project.name}
            </Typography>
          </Box>
          {project.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {project.description}
            </Typography>
          )}
          <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
            Created {new Date(project.created_at).toLocaleDateString()}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
