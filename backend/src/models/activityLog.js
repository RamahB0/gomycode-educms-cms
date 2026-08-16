const { query } = require('../config/database');

async function record(userId, action, entityType, entityId, metadata = null) {
  await query(
    `INSERT INTO activity_log (user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, action, entityType, entityId, metadata ? JSON.stringify(metadata) : null]
  );
}

async function listForEntity(entityType, entityId) {
  const { rows } = await query(
    `SELECT * FROM activity_log WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC`,
    [entityType, entityId]
  );
  return rows;
}

module.exports = { record, listForEntity };
