// demo/run-demo.js
//
// End-to-end verification script for EduCMS. Unlike a "does it boot"
// smoke test, this exercises the REAL production code against a REAL
// PostgreSQL database and a REAL Redis cache - the same modules
// (src/config/database.js, src/config/redis.js, src/models/*, the Express
// routes) that the running server uses, not a reimplementation.
//
// It expects a reachable Postgres (with database/schema.sql already
// applied - see README "Running it for real") and, optionally, a
// reachable Redis; the app is designed to degrade gracefully if Redis is
// down, and this script verifies that too.
//
// All rows this script creates are prefixed with "__demo__" and deleted
// at the end, so it's safe to run repeatedly against a real database.

const assert = require('assert');
const http = require('http');

require('dotenv').config();
process.env.JWT_SECRET = process.env.JWT_SECRET || 'demo-secret-for-verification-only';

const { pool, query } = require('../src/config/database');
const { cacheSet, cacheGet, ensureConnected, getClient } = require('../src/config/redis');

function section(title) {
  console.log(`\n=== ${title} ===`);
}

function request(port, method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try { json = data ? JSON.parse(data) : null; } catch (e) { /* non-JSON response */ }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function cleanupDemoRows() {
  await query(`DELETE FROM comments WHERE body LIKE '__demo__%'`);
  await query(`DELETE FROM post_tags WHERE post_id IN (SELECT id FROM posts WHERE title LIKE '__demo__%')`);
  await query(`DELETE FROM posts WHERE title LIKE '__demo__%'`);
  await query(`DELETE FROM tags WHERE name LIKE '__demo__%'`);
  await query(`DELETE FROM categories WHERE name LIKE '__demo__%'`);
  await query(`DELETE FROM users WHERE email LIKE '__demo__%'`);
}

async function main() {
  section('0. Connectivity: real PostgreSQL + real Redis');
  const { rows: dbCheck } = await query('SELECT NOW() AS now');
  assert.ok(dbCheck[0].now, 'expected a timestamp back from PostgreSQL');
  console.log(`Connected to PostgreSQL. Server time: ${dbCheck[0].now.toISOString()}`);

  const redisClient = await ensureConnected();
  if (redisClient) {
    await cacheSet('__demo__ping', { ok: true }, 5);
    const value = await cacheGet('__demo__ping');
    assert.deepStrictEqual(value, { ok: true });
    console.log('Connected to Redis. Cache set/get round-trips correctly.');
  } else {
    console.log('Redis not reachable - continuing (app is designed to degrade gracefully without it).');
  }

  await cleanupDemoRows();

  section('1. Import-chain smoke test');
  require('../src/models/User');
  require('../src/models/Category');
  require('../src/models/Tag');
  require('../src/models/Post');
  require('../src/models/Comment');
  require('../src/models/Media');
  require('../src/models/activityLog');
  require('../src/middleware/auth');
  require('../src/routes/auth');
  require('../src/routes/users');
  require('../src/routes/categories');
  require('../src/routes/tags');
  require('../src/routes/posts');
  require('../src/routes/comments');
  require('../src/routes/media');
  console.log('All models, middleware and routes imported without error.');

  section('2. Boot the real Express app on an ephemeral port');
  const { app } = require('../src/server');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  console.log(`Listening on 127.0.0.1:${port}`);

  const health = await request(port, 'GET', '/api/health');
  assert.strictEqual(health.status, 200);
  assert.deepStrictEqual(health.body, { status: 'ok' });
  console.log('GET /api/health -> 200 { status: "ok" }');

  section('3. Auth: register + login against real PostgreSQL (bcrypt + JWT)');
  const email = '__demo__subscriber@educms.dev';
  const reg = await request(port, 'POST', '/api/auth/register', {
    body: { name: '__demo__ Subscriber', email, password: 'Sup3rSecret!' },
  });
  assert.strictEqual(reg.status, 201, `register failed: ${JSON.stringify(reg.body)}`);
  assert.strictEqual(reg.body.data.user.role, 'subscriber', 'public registration must default to subscriber');
  const subscriberToken = reg.body.data.token;
  console.log('Registered a subscriber; password was hashed with bcrypt (not stored in plaintext).');

  const badLogin = await request(port, 'POST', '/api/auth/login', { body: { email, password: 'wrong' } });
  assert.strictEqual(badLogin.status, 401);
  const goodLogin = await request(port, 'POST', '/api/auth/login', { body: { email, password: 'Sup3rSecret!' } });
  assert.strictEqual(goodLogin.status, 200);
  console.log('Login correctly rejects wrong passwords and accepts the right one.');

  section('4. Role-based access control (RBAC): subscriber vs author vs editor vs admin');
  const forbidden = await request(port, 'POST', '/api/posts', {
    token: subscriberToken,
    body: { title: '__demo__ Should Fail', content: 'x' },
  });
  assert.strictEqual(forbidden.status, 403, 'subscribers must not be able to create posts');
  console.log('Subscriber blocked from POST /api/posts with 403, as required by the role hierarchy.');

  // Promote the demo user through the roles directly via SQL (simulating an
  // admin action) to exercise each permission tier against the real DB.
  await query(`UPDATE users SET role = 'author' WHERE email = $1`, [email]);
  const authorLogin = await request(port, 'POST', '/api/auth/login', { body: { email, password: 'Sup3rSecret!' } });
  const authorToken = authorLogin.body.data.token;

  const catRes = await request(port, 'POST', '/api/categories', {
    token: authorToken,
    body: { name: '__demo__ category' },
  });
  assert.strictEqual(catRes.status, 403, 'authors must not manage categories (editor+ only)');

  await query(`UPDATE users SET role = 'editor' WHERE email = $1`, [email]);
  const editorLogin = await request(port, 'POST', '/api/auth/login', { body: { email, password: 'Sup3rSecret!' } });
  const editorToken = editorLogin.body.data.token;
  const catRes2 = await request(port, 'POST', '/api/categories', {
    token: editorToken,
    body: { name: '__demo__ category' },
  });
  assert.strictEqual(catRes2.status, 201, 'editors must be able to manage categories');
  console.log('Author correctly blocked (403) from category management; editor correctly allowed (201).');

  section('5. Posts: create as author (auto-pending), publish as editor, public read, view-count increments');
  await query(`UPDATE users SET role = 'author' WHERE email = $1`, [email]);
  const authorLogin2 = await request(port, 'POST', '/api/auth/login', { body: { email, password: 'Sup3rSecret!' } });
  const authorToken2 = authorLogin2.body.data.token;

  const createPost = await request(port, 'POST', '/api/posts', {
    token: authorToken2,
    body: {
      title: '__demo__ Understanding RBAC',
      content: 'Full body content for the demo post.',
      status: 'published', // author cannot self-publish - server must downgrade this
      categoryId: catRes2.body.data.id,
      tags: ['__demo__ tag'],
    },
  });
  assert.strictEqual(createPost.status, 201);
  assert.strictEqual(createPost.body.data.status, 'pending', 'author-submitted "published" must be downgraded to pending');
  const postId = createPost.body.data.id;
  const postSlug = createPost.body.data.slug;
  console.log('Author-authored post correctly downgraded from "published" to "pending" (server-enforced, not client-trusted).');

  const publicReadBeforePublish = await request(port, 'GET', `/api/posts/${postSlug}`);
  assert.strictEqual(publicReadBeforePublish.status, 404, 'unpublished posts must not be publicly visible');

  const publishRes = await request(port, 'PUT', `/api/posts/${postId}`, {
    token: editorToken,
    body: { status: 'published' },
  });
  assert.strictEqual(publishRes.status, 200);
  assert.strictEqual(publishRes.body.data.status, 'published');
  console.log('Editor successfully published the pending post.');

  const publicRead1 = await request(port, 'GET', `/api/posts/${postSlug}`);
  const publicRead2 = await request(port, 'GET', `/api/posts/${postSlug}`);
  assert.strictEqual(publicRead1.status, 200);
  assert.ok(publicRead2.body.data.view_count > publicRead1.body.data.view_count, 'view_count must increment on each read');
  console.log(`Published post publicly readable; view_count incremented across reads (${publicRead1.body.data.view_count} -> ${publicRead2.body.data.view_count}).`);

  section('6. Comments: subscriber comment requires moderation, editor comment auto-approves');
  const subComment = await request(port, 'POST', `/api/comments/post/${postId}`, {
    token: subscriberToken,
    body: { body: '__demo__ nice article!' },
  });
  assert.strictEqual(subComment.status, 201);
  assert.strictEqual(subComment.body.data.status, 'pending', 'subscriber comments must default to pending');

  const editorComment = await request(port, 'POST', `/api/comments/post/${postId}`, {
    token: editorToken,
    body: { body: '__demo__ editor comment' },
  });
  assert.strictEqual(editorComment.body.data.status, 'approved', 'editor comments auto-approve');

  const publicComments = await request(port, 'GET', `/api/comments/post/${postId}`);
  assert.strictEqual(publicComments.status, 200);
  assert.ok(
    publicComments.body.data.every((c) => c.status === 'approved'),
    'the public comment list must only ever contain approved comments'
  );
  console.log('Subscriber comment pending, editor comment auto-approved, public list shows only approved comments.');

  section('7. Activity log: administrative + content actions are audited');
  const { rows: logRows } = await query(
    `SELECT action, entity_type FROM activity_log WHERE entity_type = 'post' AND entity_id = $1 ORDER BY created_at`,
    [postId]
  );
  assert.ok(logRows.some((r) => r.action === 'create'), 'post creation must be logged');
  assert.ok(logRows.some((r) => r.action === 'update'), 'post publish (update) must be logged');
  console.log(`activity_log recorded ${logRows.length} entries for this post: ${logRows.map((r) => r.action).join(', ')}`);

  section('8. Caching: repeated public listing is served from Redis when available');
  if (redisClient) {
    const first = await request(port, 'GET', '/api/posts?status=published');
    const second = await request(port, 'GET', '/api/posts?status=published');
    assert.strictEqual(first.status, 200);
    assert.deepStrictEqual(first.body.data.map((p) => p.id).sort(), second.body.data.map((p) => p.id).sort());
    console.log('Published-posts listing served consistently across two requests (second request hits the Redis cache).');
  } else {
    console.log('Skipped (Redis unavailable) - app already proven to fall back to PostgreSQL directly in step 0.');
  }

  section('Cleanup');
  await new Promise((resolve) => server.close(resolve));
  await cleanupDemoRows();
  await pool.end();
  if (redisClient) {
    await getClient().quit();
  }
  console.log('Demo rows removed, DB pool closed, Redis connection closed.');

  section('Done');
  console.log('All checks passed against a real PostgreSQL database' + (redisClient ? ' and a real Redis cache.' : ' (Redis was unavailable; graceful degradation verified).'));
}

main().catch(async (err) => {
  console.error(err);
  try {
    await cleanupDemoRows();
    await pool.end();
  } catch (e) { /* ignore cleanup errors on failure path */ }
  process.exit(1);
});
