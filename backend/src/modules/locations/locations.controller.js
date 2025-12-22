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

/**
 * GET /api/locations/countries
 * Returns: ["Germany", "Ukraine", ...]
 */
async function listCountries(req, res) {
  try {
    const r = await pool.query(
      `SELECT DISTINCT country FROM locations ORDER BY country ASC`
    );
    res.json(r.rows.map((x) => x.country));
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * GET /api/locations/cities?country=Germany
 * Returns: ["Berlin", "Munich", ...]
 */
async function listCities(req, res) {
  const { country } = req.query;
  if (!country) return res.status(400).json({ error: 'BAD_REQUEST', message: 'country is required' });

  try {
    const r = await pool.query(
      `SELECT DISTINCT city FROM locations WHERE country = $1 ORDER BY city ASC`,
      [country]
    );
    res.json(r.rows.map((x) => x.city));
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * GET /api/locations/districts?country=Germany&city=Munich
 * Returns: [{ id, district }]
 */
async function listDistricts(req, res) {
  const { country, city } = req.query;
  if (!country || !city) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'country and city are required' });
  }

  try {
    const r = await pool.query(
      `
      SELECT id, district
      FROM locations
      WHERE country = $1 AND city = $2
      ORDER BY district ASC
      `,
      [country, city]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * GET /api/locations/resolve?country=Germany&city=Munich&district=Laim
 * Returns: { id, country, city, district } or 404
 *
 * Notes:
 * - district match is exact (case-sensitive). Frontend should use values from /districts.
 */
async function resolveLocation(req, res) {
  const { country, city, district } = req.query;
  if (!country || !city || !district) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'country, city and district are required'
    });
  }

  try {
    const r = await pool.query(
      `
      SELECT id, country, city, district
      FROM locations
      WHERE country = $1 AND city = $2 AND district = $3
      LIMIT 1
      `,
      [country, city, district]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'location not found' });
    }

    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

module.exports = {
  listLocations,
  listCountries,
  listCities,
  listDistricts,
  resolveLocation
};
