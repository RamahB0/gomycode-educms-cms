const express = require('express');
const Media = require('../models/Media');
const ActivityLog = require('../models/activityLog');
const { requireAuth, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { successResponse, errorResponse, paginationParams, paginatedResponse } = require('../utils/helpers');

const router = express.Router();

router.get('/', requireAuth, requireRole('author'), async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const { rows, total } = await Media.list({ limit, offset });
    res.json(successResponse(rows, paginatedResponse({ rows, total, page, limit })));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, requireRole('author'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json(errorResponse('file is required'));
    const media = await Media.create({
      uploaderId: req.user.id,
      fileName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      altText: req.body.altText,
    });
    await ActivityLog.record(req.user.id, 'upload', 'media', media.id);
    res.status(201).json(successResponse(media));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const media = await Media.remove(req.params.id);
    if (!media) return res.status(404).json(errorResponse('Media not found'));
    await ActivityLog.record(req.user.id, 'delete', 'media', media.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
