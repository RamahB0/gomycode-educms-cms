import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Card, CardContent, CardActionArea, Chip, TextField, Grid, CircularProgress,
} from '@mui/material';
import api from '../api/client';

export default function PublicHome() {
  const [posts, setPosts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = search ? { search } : {};
    api
      .get('/posts', { params })
      .then(({ data }) => setPosts(data.data))
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Latest Articles
      </Typography>
      <TextField
        fullWidth
        label="Search articles"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 3 }}
      />
      {loading ? (
        <CircularProgress />
      ) : (
        <Grid container spacing={2}>
          {posts.map((post) => (
            <Grid item xs={12} key={post.id}>
              <Card>
                <CardActionArea component={RouterLink} to={`/posts/${post.slug}`}>
                  <CardContent>
                    <Typography variant="h6">{post.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {post.excerpt}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip size="small" label={post.author_name} />
                      {post.category_name && <Chip size="small" variant="outlined" label={post.category_name} />}
                      <Typography variant="caption" color="text.secondary">
                        {post.view_count} views
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
          {!posts.length && <Typography sx={{ p: 2 }}>No published articles yet.</Typography>}
        </Grid>
      )}
    </Box>
  );
}
