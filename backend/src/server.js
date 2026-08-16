require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const logger = require('./utils/logger');
const { errorResponse } = require('./utils/helpers');
const { uploadDir } = require('./middleware/upload');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const categoryRoutes = require('./routes/categories');
const tagRoutes = require('./routes/tags');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');
const mediaRoutes = require('./routes/media');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/media', mediaRoutes);

app.use((req, res) => res.status(404).json(errorResponse('Route not found')));

// Centralized error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json(errorResponse(err.message || 'Internal server error'));
});

function main() {
  const port = process.env.PORT || 5000;
  app.listen(port, () => logger.info(`EduCMS backend listening on port ${port}`));
}

if (require.main === module) {
  main();
}

module.exports = { app };
