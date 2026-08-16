import { useEffect, useState } from 'react';
import {
  Box, Typography, TextField, Button, List, ListItem, ListItemText, IconButton, Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../api/client';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  function load() {
    api.get('/categories').then(({ data }) => setCategories(data.data));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    await api.post('/categories', { name, description });
    setName('');
    setDescription('');
    load();
  }

  async function remove(id) {
    if (!confirm('Delete this category?')) return;
    await api.delete(`/categories/${id}`);
    load();
  }

  return (
    <Box sx={{ maxWidth: 700, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" gutterBottom>
        Categories
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth />
          <Button type="submit" variant="contained">
            Add
          </Button>
        </Stack>
      </Box>
      <List>
        {categories.map((c) => (
          <ListItem
            key={c.id}
            divider
            secondaryAction={
              <IconButton edge="end" onClick={() => remove(c.id)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText primary={c.name} secondary={c.description} />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}
