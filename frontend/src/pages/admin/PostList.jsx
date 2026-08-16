import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Chip, Select, MenuItem, IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const STATUS_COLORS = { draft: 'default', pending: 'warning', published: 'success', archived: 'default' };

export default function PostList() {
  const { user, hasRole } = useAuth();
  const [posts, setPosts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  function load() {
    const params = { limit: 50 };
    // Editors/admins see everything by default; authors only see their own via the API's
    // ownership rule enforced server-side (authorId filter here is just a UI convenience).
    if (statusFilter) params.status = statusFilter;
    if (!hasRole('editor')) params.authorId = user.id;
    api.get('/posts', { params }).then(({ data }) => setPosts(data.data));
  }

  useEffect(load, [statusFilter]);

  async function remove(id) {
    if (!confirm('Delete this post?')) return;
    await api.delete(`/posts/${id}`);
    load();
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', mt: 4, px: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">My Posts</Typography>
        <Button component={RouterLink} to="/admin/posts/new" variant="contained">
          New Post
        </Button>
      </Box>
      <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} displayEmpty sx={{ mb: 2 }}>
        <MenuItem value="">All statuses</MenuItem>
        <MenuItem value="draft">Draft</MenuItem>
        <MenuItem value="pending">Pending</MenuItem>
        <MenuItem value="published">Published</MenuItem>
        <MenuItem value="archived">Archived</MenuItem>
      </Select>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Title</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Author</TableCell>
            <TableCell>Views</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {posts.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.title}</TableCell>
              <TableCell>
                <Chip size="small" label={p.status} color={STATUS_COLORS[p.status]} />
              </TableCell>
              <TableCell>{p.author_name}</TableCell>
              <TableCell>{p.view_count}</TableCell>
              <TableCell align="right">
                <IconButton component={RouterLink} to={`/admin/posts/${p.id}/edit`} size="small">
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton onClick={() => remove(p.id)} size="small">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!posts.length && <Typography sx={{ mt: 2 }} color="text.secondary">No posts yet.</Typography>}
    </Box>
  );
}
