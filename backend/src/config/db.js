// Use Neon serverless driver (HTTP-based) when DATABASE_URL is set —
// works in Vercel/edge functions where TCP pools are unreliable.
// Falls back to standard pg pool for local docker-compose.
let pool;

if (process.env.DATABASE_URL) {
  const { Pool } = require('@neondatabase/serverless');
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
} else {
  const { Pool } = require('pg');
  pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'aaa_user',
    password: process.env.DB_PASSWORD || 'aaa_password',
    database: process.env.DB_NAME || 'aaa_portal',
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: 30000,
  });
  pool.on('error', (err) => console.error('Postgres pool error', err));
}

module.exports = pool;
