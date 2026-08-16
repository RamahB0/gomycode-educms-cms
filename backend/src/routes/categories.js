const express = require('express');
const Category = require('../models/Category');
const ActivityLog = require('../models/activityLog');
const { requireAuth, requireRole } = require('../middleware/auth');
const { slugify, successResponse, errorResponse } = require('../utils/helpers');
const { cacheDel } = require('../config/redis');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.list();
    res.json(successResponse(categories));
  } catch (err) {
    next(err);
  }
});

router.get('/:slug', async (req, res, next) => {
  try {
    const category = await Category.findBySlug(req.params.slug);
    if (!category) return res.status(404).json(errorResponse('Category not found'));
    res.json(successResponse(category));
  } catch (err) {
    next(err);
  }
});

// Editor and above can manage the taxonomy.
router.post('/', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;
    if (!name) return res.status(400).json(errorResponse('name is required'));
    const category = await Category.create({ name, slug: slugify(name), description, parentId });
    await ActivityLog.record(req.user.id, 'create', 'category', category.id);
    await cacheDel('categories:*');
    res.status(201).json(successResponse(category));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    const { name, description, parentId } = req.body;
    const category = await Category.update(req.params.id, { name, description, parentId });
    if (!category) return res.status(404).json(errorResponse('Category not found'));
    await ActivityLog.record(req.user.id, 'update', 'category', category.id);
    await cacheDel('categories:*');
    res.json(successResponse(category));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireRole('editor'), async (req, res, next) => {
  try {
    await Category.remove(req.params.id);
    await ActivityLog.record(req.user.id, 'delete', 'category', req.params.id);
    await cacheDel('categories:*');
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
