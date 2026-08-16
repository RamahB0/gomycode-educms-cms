const express = require('express');
const Tag = require('../models/Tag');
const { successResponse } = require('../utils/helpers');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const tags = await Tag.list();
    res.json(successResponse(tags));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
