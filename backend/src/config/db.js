const { Pool } = require('pg');

// Two connection modes, selected by env — no code change needed to switch:
//   1. DATABASE_URL   -> a managed Postgres (Neon / Vercel Postgres / RDS).
//                        Used on Vercel and any hosted-DB deployment. SSL on.
//   2. discrete vars  -> DB_HOST/PORT/USER/PASSWORD/NAME (the docker-compose
//                        stack). Used for self-hosted / local Docker.
const connectionString = process.env.DATABASE_URL;

// Neon and most managed Postgres require TLS. Disable only if explicitly asked
// (e.g. a hosted DB on a private network without certs) via PGSSL=disable.
const useSsl =
  !!connectionString && process.env.PGSSL !== 'disable';

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      // Keep the pool small in serverless — the platform runs many isolated
      // instances, and managed Postgres poolers (e.g. Neon pgbouncer) fan out.
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
    })
  : new Pool({
      host: process.env.DB_HOST || 'postgres',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'aaa_user',
      password: process.env.DB_PASSWORD || 'aaa_password',
      database: process.env.DB_NAME || 'aaa_portal',
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
    });

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error', err);
});

module.exports = pool;
