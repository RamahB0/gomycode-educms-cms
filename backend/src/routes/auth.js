const express = require('express');
const User = require('../models/User');
const ActivityLog = require('../models/activityLog');
const { signToken } = require('../utils/auth');
const { successResponse, errorResponse } = require('../utils/helpers');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json(errorResponse('name, email and password are required'));
    }
    if (password.length < 6) {
      return res.status(400).json(errorResponse('password must be at least 6 characters'));
    }
    const existing = await User.findByEmailWithPassword(email);
    if (existing) {
      return res.status(409).json(errorResponse('An account with that email already exists'));
    }
    // Public registration always creates a 'subscriber' - promotions to
    // author/editor/admin happen via the admin-only role-management endpoint.
    const user = await User.create({ name, email, password, role: 'subscriber' });
    await ActivityLog.record(user.id, 'register', 'user', user.id);
    const token = signToken(user);
    res.status(201).json(successResponse({ user, token }));
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json(errorResponse('email and password are required'));
    }
    const userWithHash = await User.findByEmailWithPassword(email);
    if (!userWithHash || !userWithHash.is_active) {
      return res.status(401).json(errorResponse('Invalid credentials'));
    }
    const valid = await User.comparePassword(password, userWithHash.password_hash);
    if (!valid) {
      return res.status(401).json(errorResponse('Invalid credentials'));
    }
    const user = await User.findById(userWithHash.id);
    await ActivityLog.record(user.id, 'login', 'user', user.id);
    const token = signToken(user);
    res.json(successResponse({ user, token }));
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json(errorResponse('User not found'));
    res.json(successResponse(user));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
