const { query } = require('../config/database');

async function create({ uploaderId, fileName, filePath, mimeType, sizeBytes, altText }) {
  const { rows } = await query(
    `INSERT INTO media (uploader_id, file_name, file_path, mime_type, size_bytes, alt_text)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [uploaderId || null, fileName, filePath, mimeType || null, sizeBytes || null, altText || null]
  );
  return rows[0];
}

async function list({ limit, offset }) {
  const { rows } = await query(
    `SELECT * FROM media ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM media`);
  return { rows, total: countRows[0].total };
}

async function remove(id) {
  const { rows } = await query(`DELETE FROM media WHERE id = $1 RETURNING *`, [id]);
  return rows[0] || null;
}

module.exports = { create, list, remove };
