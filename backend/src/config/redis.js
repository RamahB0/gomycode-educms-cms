const { createClient } = require('redis');
const logger = require('../utils/logger');

// EduCMS uses Redis purely as a cache in front of expensive read queries
// (e.g. the published-posts list). If Redis is unavailable the app must
// keep working - it just falls back to hitting PostgreSQL directly - so
// every helper here swallows connection errors rather than throwing.
let client = null;
let connecting = null;

function getClient() {
  if (client) return client;
  client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  client.on('error', (err) => logger.warn(`Redis error (cache disabled for this op): ${err.message}`));
  return client;
}

async function ensureConnected() {
  const c = getClient();
  if (c.isOpen) return c;
  if (!connecting) {
    connecting = c.connect().catch((err) => {
      logger.warn(`Redis connect failed, continuing without cache: ${err.message}`);
      connecting = null;
      throw err;
    });
  }
  try {
    await connecting;
    return c;
  } catch (err) {
    return null;
  }
}

async function cacheGet(key) {
  try {
    const c = await ensureConnected();
    if (!c) return null;
    const raw = await c.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.warn(`cacheGet(${key}) failed: ${err.message}`);
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 60) {
  try {
    const c = await ensureConnected();
    if (!c) return;
    await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    logger.warn(`cacheSet(${key}) failed: ${err.message}`);
  }
}

async function cacheDel(pattern) {
  try {
    const c = await ensureConnected();
    if (!c) return;
    // Simple prefix invalidation - fine at this scale, avoids needing SCAN cursors.
    const keys = await c.keys(pattern);
    if (keys.length) await c.del(keys);
  } catch (err) {
    logger.warn(`cacheDel(${pattern}) failed: ${err.message}`);
  }
}

module.exports = { getClient, ensureConnected, cacheGet, cacheSet, cacheDel };
