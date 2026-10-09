const { Pool } = require('pg');

// Pooled connections scale across concurrent requests; size is tunable
// via env for larger deployments without code changes.
// DATABASE_URL takes precedence (Neon/Supabase/Railway provide this);
// individual vars used for local docker-compose.
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: 30000,
      }
    : {
        host: process.env.DB_HOST || 'postgres',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'aaa_user',
        password: process.env.DB_PASSWORD || 'aaa_password',
        database: process.env.DB_NAME || 'aaa_portal',
        max: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: 30000,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
