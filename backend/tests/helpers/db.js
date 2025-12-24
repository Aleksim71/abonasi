'use strict';

const { pool } = require('../../src/config/db');

/**
 * Reset only volatile tables to keep location seed intact.
 * Adjust list if you add new tables.
 */
async function resetDb() {
  await pool.query('TRUNCATE TABLE ad_photos RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE ads RESTART IDENTITY CASCADE');
  await pool.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE');
}

/**
 * Ensure at least one location exists for tests.
 * If your seed already inserts Munich/Laim, this will be a no-op.
 */
async function ensureTestLocation() {
  const r = await pool.query('SELECT id FROM locations LIMIT 1');
  if (r.rowCount) return r.rows[0].id;

  const ins = await pool.query(
    `
    INSERT INTO locations (country, city, district)
    VALUES ('Germany','Munich','Laim')
    RETURNING id
    `
  );
  return ins.rows[0].id;
}

async function closeDb() {
  await pool.end();
}

module.exports = {
  pool,
  resetDb,
  ensureTestLocation,
  closeDb
};
