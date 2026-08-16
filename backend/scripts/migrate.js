// Applies database/schema.sql to the database pointed at by the PG* env vars.
// Usage: npm run migrate  (after copying .env.example to .env and creating the DB)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'educms',
    user: process.env.PGUSER || 'educms',
    password: process.env.PGPASSWORD || '',
  });
  console.log(`Applying schema.sql to ${process.env.PGDATABASE || 'educms'}...`);
  await pool.query(sql);
  console.log('Migration complete.');
  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
