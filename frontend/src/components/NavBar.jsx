import { AppBar, Toolbar, Typography, Button, Box, Chip } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ gap: 1 }}>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit', fontWeight: 700 }}
        >
          EduCMS
        </Typography>
        <Button component={RouterLink} to="/">
          Articles
        </Button>
        {hasRole('author') && (
          <Button component={RouterLink} to="/admin/posts">
            My Posts
          </Button>
        )}
        {hasRole('editor') && (
          <Button component={RouterLink} to="/admin/categories">
            Categories
          </Button>
        )}
        {hasRole('editor') && (
          <Button component={RouterLink} to="/admin/comments">
            Comments
          </Button>
        )}
        {hasRole('admin') && (
          <Button component={RouterLink} to="/admin/users">
            Users
          </Button>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {user ? (
            <>
              <Chip label={`${user.name} · ${user.role}`} size="small" />
              <Button onClick={handleLogout}>Logout</Button>
            </>
          ) : (
            <>
              <Button component={RouterLink} to="/login">
                Login
              </Button>
              <Button component={RouterLink} to="/register" variant="contained">
                Register
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
