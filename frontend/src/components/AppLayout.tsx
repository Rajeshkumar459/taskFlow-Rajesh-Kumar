import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function AppLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Container
        maxWidth="lg"
        sx={{ flex: 1, py: 4, px: { xs: 2, sm: 3 } }}
      >
        <Outlet />
      </Container>
    </Box>
  )
}
