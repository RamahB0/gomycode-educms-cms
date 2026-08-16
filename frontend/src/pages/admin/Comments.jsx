import { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell, TableBody, Chip, Button, Stack,
} from '@mui/material';
import api from '../../api/client';

// There's no single "all comments" endpoint (comments are scoped per-post in
// the public API), so the moderation queue is built by pulling every post
// then flattening their comment threads via ?all=true (editor+ only) - fine
// at this project's scale, and keeps the backend's public comment API simple.
export default function Comments() {
  const [rows, setRows] = useState([]);

  async function load() {
    const statuses = ['published', 'pending', 'draft', 'archived'];
    const postLists = await Promise.all(
      statuses.map((status) => api.get('/posts', { params: { status, limit: 100 } }).then(({ data }) => data.data))
    );
    const posts = postLists.flat();
    const all = [];
    for (const post of posts) {
      const { data } = await api
        .get(`/comments/post/${post.id}`, { params: { all: true } })
        .catch(() => ({ data: { data: [] } }));
      data.data.forEach((c) => all.push({ ...c, postTitle: post.title }));
    }
    setRows(all);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id, status) {
    await api.put(`/comments/${id}/status`, { status });
    load();
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Comment Moderation
      </Typography>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Post</TableCell>
            <TableCell>Author</TableCell>
            <TableCell>Comment</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.postTitle}</TableCell>
              <TableCell>{c.author_name}</TableCell>
              <TableCell>{c.body}</TableCell>
              <TableCell>
                <Chip size="small" label={c.status} />
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button size="small" onClick={() => setStatus(c.id, 'approved')}>
                    Approve
                  </Button>
                  <Button size="small" color="error" onClick={() => setStatus(c.id, 'spam')}>
                    Spam
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!rows.length && <Typography sx={{ mt: 2 }} color="text.secondary">No comments found.</Typography>}
    </Box>
  );
}
