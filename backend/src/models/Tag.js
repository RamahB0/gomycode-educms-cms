const { query } = require('../config/database');

async function findOrCreateMany(names = []) {
  const tags = [];
  for (const rawName of names) {
    const name = String(rawName).trim();
    if (!name) continue;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const { rows } = await query(
      `INSERT INTO tags (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING *`,
      [name, slug]
    );
    tags.push(rows[0]);
  }
  return tags;
}

async function setForPost(postId, tagIds) {
  await query(`DELETE FROM post_tags WHERE post_id = $1`, [postId]);
  for (const tagId of tagIds) {
    await query(`INSERT INTO post_tags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [postId, tagId]);
  }
}

async function listForPost(postId) {
  const { rows } = await query(
    `SELECT t.* FROM tags t JOIN post_tags pt ON pt.tag_id = t.id WHERE pt.post_id = $1 ORDER BY t.name`,
    [postId]
  );
  return rows;
}

async function list() {
  const { rows } = await query(`SELECT * FROM tags ORDER BY name ASC`);
  return rows;
}

module.exports = { findOrCreateMany, setForPost, listForPost, list };
