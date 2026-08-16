const { query } = require('../config/database');

async function create({ name, slug, description, parentId }) {
  const { rows } = await query(
    `INSERT INTO categories (name, slug, description, parent_id) VALUES ($1, $2, $3, $4) RETURNING *`,
    [name, slug, description || null, parentId || null]
  );
  return rows[0];
}

async function list() {
  const { rows } = await query(`SELECT * FROM categories ORDER BY name ASC`);
  return rows;
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM categories WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function findBySlug(slug) {
  const { rows } = await query(`SELECT * FROM categories WHERE slug = $1`, [slug]);
  return rows[0] || null;
}

async function update(id, { name, description, parentId }) {
  const { rows } = await query(
    `UPDATE categories SET name = COALESCE($2, name), description = COALESCE($3, description),
     parent_id = $4 WHERE id = $1 RETURNING *`,
    [id, name, description, parentId ?? null]
  );
  return rows[0] || null;
}

async function remove(id) {
  await query(`DELETE FROM categories WHERE id = $1`, [id]);
}

module.exports = { create, list, findById, findBySlug, update, remove };
