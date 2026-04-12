import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function AppLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar />
      <Container
        maxWidth="xl"
        sx={{ flex: 1, py: { xs: 3, sm: 4 }, px: { xs: 2, sm: 3, md: 4 } }}
      >
        <Outlet />
      </Container>
    </Box>
  )
}
