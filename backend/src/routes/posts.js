const express = require('express');
const Post = require('../models/Post');
const Tag = require('../models/Tag');
const ActivityLog = require('../models/activityLog');
const { requireAuth, requireRole, optionalAuth, ROLE_RANK } = require('../middleware/auth');
const { slugify, paginationParams, paginatedResponse, successResponse, errorResponse } = require('../utils/helpers');
const { cacheGet, cacheSet, cacheDel } = require('../config/redis');

const router = express.Router();

// Public listing - only published posts unless the caller is authenticated
// with author-or-above privileges and explicitly asks for another status.
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const canSeeAllStatuses = req.user && ROLE_RANK[req.user.role] >= ROLE_RANK.author;
    const status = canSeeAllStatuses && req.query.status ? req.query.status : 'published';
    const cacheKey = `posts:list:${status}:${req.query.categoryId || ''}:${req.query.search || ''}:${page}:${limit}`;

    if (!req.query.search) {
      const cached = await cacheGet(cacheKey);
      if (cached) return res.json(cached);
    }

    const { rows, total } = await Post.list({
      status,
      categoryId: req.query.categoryId || null,
      authorId: req.query.authorId || null,
      search: req.query.search || null,
      limit,
      offset,
    });
    const body = successResponse(rows, paginatedResponse({ rows, total, page, limit }));
    if (!req.query.search) await cacheSet(cacheKey, body, 30);
    res.json(body);
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', optionalAuth, async (req, res, next) => {
  try {
    const post = await Post.findBySlug(req.params.slug);
    if (!post) return res.status(404).json(errorResponse('Post not found'));

    const isOwnerOrPrivileged = req.user && (req.user.id === post.author_id || ROLE_RANK[req.user.role] >= ROLE_RANK.editor);
    if (post.status !== 'published' && !isOwnerOrPrivileged) {
      return res.status(404).json(errorResponse('Post not found'));
    }
    if (post.status === 'published') {
      await Post.incrementViewCount(post.id);
    }
    const tags = await Tag.listForPost(post.id);
    res.json(successResponse({ ...post, tags }));
  } catch (err) {
    next(err);
  }
});

// Any author-or-above can create a post (as themselves).
router.post('/', requireAuth, requireRole('author'), async (req, res, next) => {
  try {
    const { title, excerpt, content, featuredImageUrl, status, categoryId, tags,
      seoTitle, seoDescription, seoKeywords } = req.body;
    if (!title || !content) {
      return res.status(400).json(errorResponse('title and content are required'));
    }
    // Only editors/admins may publish directly; authors submit as draft/pending.
    const canPublish = ROLE_RANK[req.user.role] >= ROLE_RANK.editor;
    const requestedStatus = status || 'draft';
    const finalStatus = requestedStatus === 'published' && !canPublish ? 'pending' : requestedStatus;

    const post = await Post.create({
      title, slug: `${slugify(title)}-${Date.now().toString(36)}`, excerpt, content,
      featuredImageUrl, status: finalStatus, authorId: req.user.id, categoryId,
      seoTitle, seoDescription, seoKeywords,
    });

    if (Array.isArray(tags) && tags.length) {
      const tagRows = await Tag.findOrCreateMany(tags);
      await Tag.setForPost(post.id, tagRows.map((t) => t.id));
    }

    await ActivityLog.record(req.user.id, 'create', 'post', post.id, { status: finalStatus });
    await cacheDel('posts:list:*');
    res.status(201).json(successResponse(post));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, requireRole('author'), async (req, res, next) => {
  try {
    const existing = await Post.findById(req.params.id);
    if (!existing) return res.status(404).json(errorResponse('Post not found'));

    const isOwner = existing.author_id === req.user.id;
    const isPrivileged = ROLE_RANK[req.user.role] >= ROLE_RANK.editor;
    if (!isOwner && !isPrivileged) {
      return res.status(403).json(errorResponse('You can only edit your own posts'));
    }

    const fields = { ...req.body };
    if (fields.status === 'published' && !isPrivileged) {
      fields.status = 'pending'; // authors can't self-publish
    }
    if (fields.featuredImageUrl !== undefined) {
      fields.featured_image_url = fields.featuredImageUrl;
      delete fields.featuredImageUrl;
    }
    if (fields.categoryId !== undefined) {
      fields.category_id = fields.categoryId;
      delete fields.categoryId;
    }
    if (fields.seoTitle !== undefined) { fields.seo_title = fields.seoTitle; delete fields.seoTitle; }
    if (fields.seoDescription !== undefined) { fields.seo_description = fields.seoDescription; delete fields.seoDescription; }
    if (fields.seoKeywords !== undefined) { fields.seo_keywords = fields.seoKeywords; delete fields.seoKeywords; }

    const tags = fields.tags;
    delete fields.tags;

    const post = await Post.update(req.params.id, fields);
    if (Array.isArray(tags)) {
      const tagRows = await Tag.findOrCreateMany(tags);
      await Tag.setForPost(post.id, tagRows.map((t) => t.id));
    }
    await ActivityLog.record(req.user.id, 'update', 'post', post.id);
    await cacheDel('posts:list:*');
    res.json(successResponse(post));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('author'), async (req, res, next) => {
  try {
    const existing = await Post.findById(req.params.id);
    if (!existing) return res.status(404).json(errorResponse('Post not found'));
    const isOwner = existing.author_id === req.user.id;
    const isPrivileged = ROLE_RANK[req.user.role] >= ROLE_RANK.editor;
    if (!isOwner && !isPrivileged) {
      return res.status(403).json(errorResponse('You can only delete your own posts'));
    }
    await Post.remove(req.params.id);
    await ActivityLog.record(req.user.id, 'delete', 'post', req.params.id);
    await cacheDel('posts:list:*');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
