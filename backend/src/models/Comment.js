const { query } = require('../config/database');

async function create({ postId, userId, parentId, authorName, authorEmail, body, status }) {
  const { rows } = await query(
    `INSERT INTO comments (post_id, user_id, parent_id, author_name, author_email, body, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [postId, userId || null, parentId || null, authorName || null, authorEmail || null, body, status || 'pending']
  );
  return rows[0];
}

async function listForPost(postId, { onlyApproved = true } = {}) {
  const statusClause = onlyApproved ? `AND status = 'approved'` : '';
  const { rows } = await query(
    `SELECT * FROM comments WHERE post_id = $1 ${statusClause} ORDER BY created_at ASC`,
    [postId]
  );
  return rows;
}

async function updateStatus(id, status) {
  const { rows } = await query(`UPDATE comments SET status = $2 WHERE id = $1 RETURNING *`, [id, status]);
  return rows[0] || null;
}

async function remove(id) {
  await query(`DELETE FROM comments WHERE id = $1`, [id]);
}

async function findById(id) {
  const { rows } = await query(`SELECT * FROM comments WHERE id = $1`, [id]);
  return rows[0] || null;
}

module.exports = { create, listForPost, updateStatus, remove, findById };
