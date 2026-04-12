import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
// import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Tooltip from '@mui/material/Tooltip'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'
import { alpha } from '@mui/material/styles'

function brandColor(str: string): string {
  const colors = ['#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706']
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff
  return colors[Math.abs(h) % colors.length]
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { mode, toggleMode } = useThemeMode()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isDark = mode === 'dark'
  const initials = user
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : ''
  const avatarBg = user ? brandColor(user.name) : '#4f46e5'

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: isDark
          ? alpha('#1a2232', 0.92)
          : alpha('#ffffff', 0.9),
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 } }}>
        {/* ── Brand ─────────────────────────────────────────────────── */}
        <Box
          onClick={() => navigate('/projects')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            cursor: 'pointer',
            textDecoration: 'none',
            mr: 1,
          }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 2px 8px ${alpha('#4f46e5', 0.4)}`,
              flexShrink: 0,
            }}
          >
            {/* Simple checkmark SVG logo */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5L6.5 12L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{
              color: 'text.primary',
              letterSpacing: '-0.02em',
              display: { xs: 'none', sm: 'block' },
            }}
          >
            TaskFlow
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        {/* ── Actions ───────────────────────────────────────────────── */}
        <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton
            onClick={toggleMode}
            size="small"
            sx={{
              color: 'text.secondary',
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderRadius: 2,
              '&:hover': {
                bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              },
            }}
          >
            {isDark ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {user && (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.5,
                borderRadius: 2.5,
                bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Avatar
                sx={{
                  width: 26,
                  height: 26,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: avatarBg,
                  boxShadow: `0 0 0 2px ${alpha(avatarBg, 0.25)}`,
                }}
              >
                {initials}
              </Avatar>
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  color: 'text.primary',
                  display: { xs: 'none', sm: 'block' },
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.name.split(' ')[0]}
              </Typography>
            </Box>

            <Tooltip title="Sign out">
              <IconButton
                onClick={handleLogout}
                size="small"
                sx={{
                  color: 'text.secondary',
                  '&:hover': { color: 'error.main' },
                }}
              >
                <LogoutRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Toolbar>
    </AppBar>
  )
}
