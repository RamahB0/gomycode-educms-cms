const express = require('express');
const Comment = require('../models/Comment');
const Post = require('../models/Post');
const ActivityLog = require('../models/activityLog');
const { requireAuth, requireRole, optionalAuth, ROLE_RANK } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/helpers');

const router = express.Router();

// Public callers only ever see approved comments. Editors/admins may pass
// ?all=true to additionally see pending/spam/trash for moderation purposes.
router.get('/post/:postId', optionalAuth, async (req, res, next) => {
  try {
    const canSeeAll = req.query.all === 'true' && req.user && ROLE_RANK[req.user.role] >= ROLE_RANK.editor;
    const comments = await Comment.listForPost(req.params.postId, { onlyApproved: !canSeeAll });
    res.json(successResponse(comments));
  } catch (err) {
    next(err);
  }
});

// Any authenticated user (subscriber and up) can comment. New comments from
// subscribers require moderation; editors/admins auto-approve their own.
router.post('/post/:postId', requireAuth, async (req, res, next) => {
  try {
    const { body, parentId } = req.body;
    if (!body || !body.trim()) return res.status(400).json(errorResponse('body is required'));
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json(errorResponse('Post not found'));

    const autoApprove = ROLE_RANK[req.user.role] >= ROLE_RANK.editor;
    const comment = await Comment.create({
      postId: post.id,
      userId: req.user.id,
      parentId: parentId || null,
      authorName: req.user.email,
      authorEmail: req.user.email,
      body,
      status: autoApprove ? 'approved' : 'pending',
    });
    await ActivityLog.record(req.user.id, 'create', 'comment', comment.id);
    res.status(201).json(successResponse(comment));
  } catch (err) {
    next(err);
  }
});

// Editor/admin moderation.
router.put('/:id/status', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'spam', 'trash'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json(errorResponse(`status must be one of ${validStatuses.join(', ')}`));
    }
    const comment = await Comment.updateStatus(req.params.id, status);
    if (!comment) return res.status(404).json(errorResponse('Comment not found'));
    await ActivityLog.record(req.user.id, 'moderate', 'comment', comment.id, { status });
    res.json(successResponse(comment));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    await Comment.remove(req.params.id);
    await ActivityLog.record(req.user.id, 'delete', 'comment', req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
