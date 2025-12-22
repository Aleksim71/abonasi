'use strict';

const { pool } = require('../../config/db');

/**
 * GET /api/locations
 * Optional filters:
 * - ?country=Germany
 * - ?city=Munich
 *
 * Returns: [{ id, country, city, district }]
 */
async function listLocations(req, res) {
  const { country, city } = req.query;

  const filters = [];
  const values = [];
  let i = 1;

  if (country) {
    filters.push(`country = $${i++}`);
    values.push(country);
  }

  if (city) {
    filters.push(`city = $${i++}`);
    values.push(city);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  const sql = `
    SELECT id, country, city, district
    FROM locations
    ${where}
    ORDER BY country ASC, city ASC, district ASC
  `;

  try {
    const result = await pool.query(sql, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

module.exports = {
  listLocations
};
