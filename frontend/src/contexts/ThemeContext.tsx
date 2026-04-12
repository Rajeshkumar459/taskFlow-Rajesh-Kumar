import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
  CssBaseline,
  alpha,
} from '@mui/material'

type ColorMode = 'light' | 'dark'

interface ThemeContextType {
  mode: ColorMode
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextType>({ mode: 'light', toggleMode: () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeMode = () => useContext(ThemeContext)

function buildTheme(mode: ColorMode) {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main:  isDark ? '#818cf8' : '#4f46e5',
        light: isDark ? '#a5b4fc' : '#6366f1',
        dark:  isDark ? '#4f46e5' : '#3730a3',
        contrastText: '#ffffff',
      },
      secondary: {
        main: isDark ? '#22d3ee' : '#0891b2',
      },
      error:   { main: '#ef4444' },
      warning: { main: '#f59e0b' },
      success: { main: '#10b981' },
      background: {
        default: isDark ? '#0d1117' : '#f1f5f9',
        paper:   isDark ? '#161b22' : '#ffffff',
      },
      divider: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      text: {
        primary:   isDark ? '#e2e8f0' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#475569',
        disabled:  isDark ? '#64748b' : '#94a3b8',
      },
    },

    shape: { borderRadius: 10 },

    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.025em' },
      h5: { fontWeight: 700, letterSpacing: '-0.02em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { fontWeight: 600, letterSpacing: '0.01em' },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': { boxSizing: 'border-box' },
          body: {
            backgroundImage: isDark
              ? 'radial-gradient(ellipse at 20% 0%, rgba(79,70,229,0.08) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at 20% 0%, rgba(79,70,229,0.04) 0%, transparent 60%)',
          },
          '::-webkit-scrollbar': { width: 6, height: 6 },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          '::-webkit-scrollbar-thumb': {
            background: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
            borderRadius: 99,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 8, fontWeight: 600 },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: isDark
                ? `0 4px 16px ${alpha('#818cf8', 0.35)}`
                : `0 4px 16px ${alpha('#4f46e5', 0.25)}`,
            },
          },
          outlined: {
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
            '&:hover': {
              borderColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)',
            },
          },
          text: {
            color: isDark ? '#e2e8f0' : undefined,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            transition: 'background-color 0.2s, border-color 0.2s',
          },
          outlined: {
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)',
          },
          elevation1: {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
              : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
          },
          elevation2: {
            boxShadow: isDark
              ? '0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)'
              : '0 4px 12px rgba(0,0,0,0.08)',
          },
          elevation8: {
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)'
              : '0 8px 24px rgba(0,0,0,0.12)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            transition: 'box-shadow 0.2s, border-color 0.2s',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: 'none',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, fontSize: '0.75rem' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRadius: 16,
            border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: isDark
              ? '0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)'
              : '0 20px 60px rgba(0,0,0,0.15)',
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              transition: 'box-shadow 0.15s',
              '& fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
              },
              '&:hover fieldset': {
                borderColor: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.3)',
              },
              '&.Mui-focused fieldset': {
                borderColor: isDark ? '#818cf8' : '#4f46e5',
              },
              '&.Mui-focused': {
                boxShadow: isDark
                  ? `0 0 0 3px ${alpha('#818cf8', 0.25)}`
                  : `0 0 0 3px ${alpha('#4f46e5', 0.12)}`,
              },
            },
            '& .MuiInputLabel-root': {
              color: isDark ? '#94a3b8' : undefined,
            },
            '& .MuiInputBase-input': {
              color: isDark ? '#e2e8f0' : undefined,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '0.75rem',
            fontWeight: 500,
            borderRadius: 6,
            padding: '5px 10px',
            backgroundColor: isDark ? '#334155' : '#1e293b',
            color: '#f1f5f9',
            boxShadow: isDark ? '0 4px 12px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.2)',
          },
          arrow: {
            color: isDark ? '#334155' : '#1e293b',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 99 },
          bar: { borderRadius: 99 },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10 },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: isDark ? '#94a3b8' : undefined,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(129,140,248,0.15)' : 'rgba(79,70,229,0.08)',
            },
            '&.Mui-selected:hover': {
              backgroundColor: isDark ? 'rgba(129,140,248,0.22)' : 'rgba(79,70,229,0.12)',
            },
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: '8px !important',
            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
            color: isDark ? '#94a3b8' : undefined,
            '&.Mui-selected': {
              color: isDark ? '#e2e8f0' : undefined,
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : undefined,
            },
          },
        },
      },
    },
  })
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>(() => {
    const stored = localStorage.getItem('taskflow_theme') as ColorMode | null
    if (stored === 'light' || stored === 'dark') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const toggleMode = () => {
    setMode((m) => {
      const next = m === 'light' ? 'dark' : 'light'
      localStorage.setItem('taskflow_theme', next)
      return next
    })
  }

  const theme = useMemo(() => buildTheme(mode), [mode])

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  )
}
