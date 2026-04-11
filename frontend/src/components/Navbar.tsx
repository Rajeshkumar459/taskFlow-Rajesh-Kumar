import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <AssignmentIcon sx={{ mr: 1 }} />
        <Typography
          variant="h6"
          component="div"
          sx={{ cursor: 'pointer', flexGrow: 0 }}
          onClick={() => navigate('/projects')}
        >
          TaskFlow
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {user && (
          <>
            <Typography variant="body2" sx={{ mr: 2, opacity: 0.9 }}>
              {user.name}
            </Typography>
            <Button color="inherit" onClick={handleLogout} size="small">
              Logout
            </Button>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}
