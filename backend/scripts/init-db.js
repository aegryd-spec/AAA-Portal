// One-time database initialiser for a managed Postgres (Neon / Vercel Postgres).
//
//   DATABASE_URL="postgres://user:pass@host/db?sslmode=require" npm run db:init
//
// Runs the schema, seed, and migrations in order. Safe to re-run: the schema
// and migrations use IF NOT EXISTS, and the seed uses ON CONFLICT guards.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Example:');
  console.error('  DATABASE_URL="postgres://user:pass@host/db?sslmode=require" npm run db:init');
  process.exit(1);
}

const files = [
  '01_schema.sql',
  '02_seed.sql',
  '03_migration_requires_document.sql',
  '04_migration_tasks_notifications.sql',
];

const dbDir = path.join(__dirname, '..', '..', 'db');

(async () => {
  const client = new Client({
    connectionString: url,
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(dbDir, f), 'utf8');
      process.stdout.write(`Running ${f} ... `);
      await client.query(sql);
      console.log('ok');
    }
    console.log('\nDatabase initialised.');
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error('\nDB init failed:', err.message);
  process.exit(1);
});
