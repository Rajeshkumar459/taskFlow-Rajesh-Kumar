import { useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Link from '@mui/material/Link'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { register } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }

    setLoading(true)
    setError('')
    setFieldErrors({})

    try {
      const res = await register(name.trim(), email.trim(), password)
      authLogin(res.token, res.user)
      navigate('/projects')
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) {
          setFieldErrors(err.fields)
        } else {
          setError(err.message)
        }
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.50',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }} elevation={2}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            <AssignmentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
            <Typography variant="h5" fontWeight={600}>
              Create your account
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Full Name"
              fullWidth
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!fieldErrors.name}
              helperText={fieldErrors.name}
              sx={{ mb: 2 }}
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
              sx={{ mb: 2 }}
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={!!fieldErrors.password}
              helperText={fieldErrors.password || 'At least 8 characters'}
              sx={{ mb: 3 }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </Box>

          <Typography variant="body2" align="center" sx={{ mt: 3 }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login">
              Sign in
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
