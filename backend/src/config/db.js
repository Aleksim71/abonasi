'use strict';

const { Pool } = require('pg');

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

const pool = new Pool({
  host: required('DB_HOST'),
  port: Number(required('DB_PORT')),
  database: required('DB_NAME'),
  user: required('DB_USER'),
  password: required('DB_PASSWORD'),
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

/**
 * DB healthcheck
 * - used by /api/health
 * - NEVER throws (caller may wrap, but we keep it safe too)
 */
async function dbHealthcheck() {
  const t0 = Date.now();
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return {
      ok: true,
      latencyMs: Date.now() - t0
    };
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  dbHealthcheck
};
