const { Pool } = require('pg');

// A single shared connection pool for the whole app. Reads its settings
// from the standard PG* environment variables (see .env.example), which
// `pg` picks up automatically, plus an explicit fallback so local dev
// works even before a .env file exists.
const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || 'educms',
  user: process.env.PGUSER || 'educms',
  password: process.env.PGPASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  // Idle client errors shouldn't crash the whole process.
  // eslint-disable-next-line no-console
  console.error('Unexpected PostgreSQL pool error', err);
});

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
