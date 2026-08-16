import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, TextField, Button, MenuItem, Select, InputLabel, FormControl, Stack, Alert,
} from '@mui/material';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

export default function PostEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: '', excerpt: '', content: '', categoryId: '', tags: '', status: 'draft',
    seoTitle: '', seoDescription: '', seoKeywords: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/categories').then(({ data }) => setCategories(data.data));
  }, []);

  // Posts are fetched by slug on the public API; for editing we instead
  // look the post up from the "my posts" list already loaded server-side,
  // so fetch the full list and find it by id.
  useEffect(() => {
    if (!isEdit) return;
    api.get('/posts', { params: { limit: 100 } }).then(({ data }) => {
      const existing = data.data.find((p) => String(p.id) === String(id));
      if (existing) {
        setForm({
          title: existing.title,
          excerpt: existing.excerpt || '',
          content: existing.content,
          categoryId: existing.category_id || '',
          tags: '',
          status: existing.status,
          seoTitle: existing.seo_title || '',
          seoDescription: existing.seo_description || '',
          seoKeywords: existing.seo_keywords || '',
        });
      }
    });
  }, [id, isEdit]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const payload = {
      title: form.title,
      excerpt: form.excerpt,
      content: form.content,
      categoryId: form.categoryId || null,
      status: form.status,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      seoKeywords: form.seoKeywords,
    };
    if (form.tags) payload.tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      if (isEdit) {
        await api.put(`/posts/${id}`, payload);
      } else {
        await api.post('/posts', payload);
      }
      navigate('/admin/posts');
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    }
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        {isEdit ? 'Edit Post' : 'New Post'}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Box component="form" onSubmit={handleSubmit}>
        <Stack spacing={2}>
          <TextField label="Title" value={form.title} onChange={set('title')} required />
          <TextField label="Excerpt" value={form.excerpt} onChange={set('excerpt')} />
          <TextField label="Content" value={form.content} onChange={set('content')} multiline minRows={8} required />
          <FormControl>
            <InputLabel>Category</InputLabel>
            <Select value={form.categoryId} label="Category" onChange={set('categoryId')}>
              <MenuItem value="">None</MenuItem>
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Tags (comma separated)" value={form.tags} onChange={set('tags')} />
          <FormControl>
            <InputLabel>Status</InputLabel>
            <Select value={form.status} label="Status" onChange={set('status')}>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="pending">Pending review</MenuItem>
              {hasRole('editor') && <MenuItem value="published">Published</MenuItem>}
              {hasRole('editor') && <MenuItem value="archived">Archived</MenuItem>}
            </Select>
          </FormControl>

          <Typography variant="subtitle1">SEO</Typography>
          <TextField label="SEO Title" value={form.seoTitle} onChange={set('seoTitle')} />
          <TextField label="SEO Description" value={form.seoDescription} onChange={set('seoDescription')} />
          <TextField label="SEO Keywords" value={form.seoKeywords} onChange={set('seoKeywords')} />

          <Button type="submit" variant="contained">
            Save
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
