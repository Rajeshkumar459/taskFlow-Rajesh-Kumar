import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded'
import { register } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const { login: authLogin } = useAuth()
  const navigate = useNavigate()

  const validate = () => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!email.trim()) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email address'
    if (!password) errs.password = 'Password is required'
    else if (password.length < 8) errs.password = 'Password must be at least 8 characters'
    return errs
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    setLoading(true); setError(''); setFieldErrors({})
    try {
      const res = await register(name.trim(), email.trim(), password)
      authLogin(res.token, res.user)
      navigate('/projects')
    } catch (err) {
      if (err instanceof ApiError) {
        err.fields ? setFieldErrors(err.fields) : setError(err.message)
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Left branding panel ─────────────────────────────────────── */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          width: '45%',
          px: 8,
          py: 6,
          background: 'linear-gradient(145deg, #3730a3 0%, #4f46e5 45%, #7c3aed 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <Box sx={{ position: 'absolute', bottom: -100, left: -60, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 6 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 11L8 15L16 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Box>
          <Typography variant="h5" fontWeight={700} sx={{ color: 'white', letterSpacing: '-0.02em' }}>TaskFlow</Typography>
        </Box>

        <Typography variant="h3" fontWeight={700} sx={{ color: 'white', mb: 2, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          Start for free.<br />Ship faster.
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 5, lineHeight: 1.7 }}>
          Join your team and start managing projects in minutes — no credit card needed.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {['Free to use, always', 'No setup required', 'Invite your team instantly'].map((t) => (
            <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5.5L4 7.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', fontWeight: 500 }}>{t}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Right form panel ────────────────────────────────────────── */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          px: { xs: 2, sm: 4 },
          py: 6,
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          {/* Mobile brand */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1.25, mb: 5 }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '9px', background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5L6.5 12L13 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Box>
            <Typography variant="h6" fontWeight={700} color="text.primary">TaskFlow</Typography>
          </Box>

          <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ mb: 0.75 }}>
            Create your account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Get started in seconds — it's completely free
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Full name"
              fullWidth
              required
              autoFocus
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name}
            />
            <TextField
              label="Email address"
              type="email"
              fullWidth
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={!!fieldErrors.email}
              helperText={fieldErrors.email}
            />
            <TextField
              label="Password"
              type={showPwd ? 'text' : 'password'}
              fullWidth
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password || 'At least 8 characters'}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPwd((v) => !v)} edge="end">
                      {showPwd ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{ py: 1.4, fontSize: '0.95rem' }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </Box>

          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link
                component={RouterLink}
                to="/login"
                fontWeight={600}
                sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
              >
                Sign in
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
