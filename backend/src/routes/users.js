const express = require('express');
const User = require('../models/User');
const ActivityLog = require('../models/activityLog');
const { requireAuth, requireRole } = require('../middleware/auth');
const { successResponse, errorResponse, paginationParams, paginatedResponse } = require('../utils/helpers');

const router = express.Router();

// Admin-only: list all users.
router.get('/', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { page, limit, offset } = paginationParams(req.query);
    const { rows, total } = await User.list({ limit, offset });
    res.json(successResponse(rows, { pagination: paginatedResponse({ rows, total, page, limit }).pagination }));
  } catch (err) {
    next(err);
  }
});

// Admin-only: change a user's role (the core of role-based access control management).
router.put('/:id/role', requireAuth, requireRole('admin'), async (req, res, next) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'editor', 'author', 'subscriber'];
    if (!validRoles.includes(role)) {
      return res.status(400).json(errorResponse(`role must be one of ${validRoles.join(', ')}`));
    }
    const user = await User.updateRole(req.params.id, role);
    if (!user) return res.status(404).json(errorResponse('User not found'));
    await ActivityLog.record(req.user.id, 'update_role', 'user', user.id, { role });
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json(errorResponse('User not found'));
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
