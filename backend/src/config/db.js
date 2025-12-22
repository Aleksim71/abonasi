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

async function dbHealthcheck() {
  try {
    const r = await pool.query('SELECT 1 AS ok');
    return { ok: true, result: r.rows[0].ok };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

module.exports = {
  pool,
  dbHealthcheck
};
