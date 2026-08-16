import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Typography, Chip, Divider, TextField, Button, List, ListItem, ListItemText, Alert,
} from '@mui/material';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function PublicPost() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentBody, setCommentBody] = useState('');
  const [notice, setNotice] = useState('');

  function loadComments(postId) {
    api.get(`/comments/post/${postId}`).then(({ data }) => setComments(data.data));
  }

  useEffect(() => {
    api.get(`/posts/${slug}`).then(({ data }) => {
      setPost(data.data);
      loadComments(data.data.id);
    });
  }, [slug]);

  async function submitComment(e) {
    e.preventDefault();
    setNotice('');
    const { data } = await api.post(`/comments/post/${post.id}`, { body: commentBody });
    setCommentBody('');
    setNotice(
      data.data.status === 'approved'
        ? 'Comment posted.'
        : 'Comment submitted and is awaiting moderator approval.'
    );
    if (data.data.status === 'approved') loadComments(post.id);
  }

  if (!post) return null;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        {post.title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <Chip size="small" label={post.author_name} />
        {post.category_name && <Chip size="small" variant="outlined" label={post.category_name} />}
        {post.tags?.map((t) => (
          <Chip key={t.id} size="small" variant="outlined" label={`#${t.name}`} />
        ))}
      </Box>
      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 4 }}>
        {post.content}
      </Typography>

      <Divider sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Comments ({comments.length})
      </Typography>
      <List>
        {comments.map((c) => (
          <ListItem key={c.id} alignItems="flex-start" divider>
            <ListItemText primary={c.author_name} secondary={c.body} />
          </ListItem>
        ))}
        {!comments.length && <Typography color="text.secondary">No comments yet.</Typography>}
      </List>

      {user ? (
        <Box component="form" onSubmit={submitComment} sx={{ mt: 2 }}>
          {notice && <Alert severity="info" sx={{ mb: 2 }}>{notice}</Alert>}
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Add a comment"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            required
          />
          <Button type="submit" variant="contained" sx={{ mt: 1 }}>
            Post comment
          </Button>
        </Box>
      ) : (
        <Typography color="text.secondary">Log in to leave a comment.</Typography>
      )}
    </Box>
  );
}
