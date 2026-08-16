const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const PUBLIC_COLUMNS = `id, name, email, role, avatar_url, bio, is_active, created_at, updated_at`;

async function create({ name, email, password, role = 'subscriber' }) {
  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING ${PUBLIC_COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

async function findByEmailWithPassword(email) {
  const { rows } = await query(`SELECT * FROM users WHERE email = $1`, [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] || null;
}

async function list({ limit, offset }) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM users`);
  return { rows, total: countRows[0].total };
}

async function updateRole(id, role) {
  const { rows } = await query(
    `UPDATE users SET role = $2 WHERE id = $1 RETURNING ${PUBLIC_COLUMNS}`,
    [id, role]
  );
  return rows[0] || null;
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { create, findByEmailWithPassword, findById, list, updateRole, comparePassword };
