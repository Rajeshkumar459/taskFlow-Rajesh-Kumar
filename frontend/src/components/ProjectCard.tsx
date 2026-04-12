import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import Tooltip from '@mui/material/Tooltip'
import Chip from '@mui/material/Chip'
import FolderIcon from '@mui/icons-material/Folder'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useNavigate } from 'react-router-dom'
import type { Project, TaskCounts } from '../types'

interface Props {
  project: Project
  taskCounts?: TaskCounts
}

const STATUS_DOT: Array<{ key: keyof Omit<TaskCounts, 'total' | 'overdue'>; color: string; label: string }> = [
  { key: 'todo',        color: '#64748b', label: 'To Do'       },
  { key: 'in_progress', color: '#f59e0b', label: 'In Progress' },
  { key: 'done',        color: '#10b981', label: 'Done'        },
]

export default function ProjectCard({ project, taskCounts }: Props) {
  const navigate = useNavigate()
  const pct = taskCounts && taskCounts.total > 0
    ? Math.round((taskCounts.done / taskCounts.total) * 100)
    : 0

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.15s',
        '&:hover': {
          boxShadow: 4,
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardActionArea
        onClick={() => navigate(`/projects/${project.id}`)}
        sx={{ height: '100%', alignItems: 'flex-start' }}
      >
        <CardContent sx={{ pb: taskCounts ? 1.5 : 2 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1, gap: 1 }}>
            <FolderIcon color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
            <Typography variant="h6" component="div" fontWeight={600} sx={{ lineHeight: 1.25 }}>
              {project.name}
            </Typography>
          </Box>

          {/* Description */}
          {project.description ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                mb: 1.5,
              }}
            >
              {project.description}
            </Typography>
          ) : (
            <Box sx={{ mb: 1.5 }} />
          )}

          {/* Task breakdown (shown when stats are available) */}
          {taskCounts && (
            <Box sx={{ mb: 1 }}>
              {/* Progress bar */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {taskCounts.total === 0 ? 'No tasks yet' : `${taskCounts.done} / ${taskCounts.total} done`}
                </Typography>
                {taskCounts.total > 0 && (
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    {pct}%
                  </Typography>
                )}
              </Box>
              {taskCounts.total > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={pct}
                  sx={{
                    height: 5,
                    borderRadius: 3,
                    bgcolor: 'action.hover',
                    mb: 1,
                    '& .MuiLinearProgress-bar': {
                      bgcolor: pct === 100 ? '#10b981' : 'primary.main',
                    },
                  }}
                />
              )}

              {/* Status dots */}
              {taskCounts.total > 0 && (
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {STATUS_DOT.map(({ key, color, label }) => (
                    <Tooltip key={key} title={label} placement="top">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                        <Box
                          component="span"
                          sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }}
                        />
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          {taskCounts[key]}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              )}
            </Box>
          )}

          {/* Created date + overdue badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" color="text.disabled">
              Created {new Date(project.created_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              })}
            </Typography>
            {taskCounts && taskCounts.overdue > 0 && (
              <Tooltip title="Overdue tasks">
                <Chip
                  icon={<WarningAmberIcon />}
                  label={taskCounts.overdue}
                  size="small"
                  color="error"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem', '& .MuiChip-icon': { fontSize: 12 }, '& .MuiChip-label': { px: 0.75 } }}
                />
              </Tooltip>
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
