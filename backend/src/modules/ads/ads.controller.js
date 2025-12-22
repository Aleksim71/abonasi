'use strict';

const { pool } = require('../../config/db');

function isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/**
 * POST /api/ads
 * requires auth
 * body: { locationId, title, description, priceCents? }
 * -> creates draft
 */
async function createDraft(req, res) {
  const userId = req.user?.id;

  const locationId = String(req.body.locationId || '').trim();
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();

  const priceCentsRaw = req.body.priceCents;
  const priceCents = (priceCentsRaw === null || priceCentsRaw === undefined || priceCentsRaw === '')
    ? null
    : Number(priceCentsRaw);

  if (!isUuid(locationId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId must be a UUID' });
  }
  if (title.length < 3 || title.length > 120) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'title must be 3..120 chars' });
  }
  if (description.length < 10 || description.length > 5000) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'description must be 10..5000 chars' });
  }
  if (priceCents !== null && (!Number.isInteger(priceCents) || priceCents < 0)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'priceCents must be a non-negative integer or null' });
  }

  try {
    const r = await pool.query(
      `
      INSERT INTO ads (user_id, location_id, title, description, price_cents, status)
      VALUES ($1, $2, $3, $4, $5, 'draft')
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [userId, locationId, title, description, priceCents]
    );

    return res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err && err.code === '23503') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId does not exist' });
    }
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * PATCH /api/ads/:id
 * requires auth
 * body (any subset):
 * - title
 * - description
 * - priceCents (number | null)
 * - locationId (uuid)
 *
 * Only allowed if status = 'draft' and owner matches
 */
async function updateDraft(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  const fields = [];
  const values = [];
  let i = 1;

  if (req.body.title !== undefined) {
    const title = String(req.body.title || '').trim();
    if (title.length < 3 || title.length > 120) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'title must be 3..120 chars' });
    }
    fields.push(`title = $${i++}`);
    values.push(title);
  }

  if (req.body.description !== undefined) {
    const description = String(req.body.description || '').trim();
    if (description.length < 10 || description.length > 5000) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'description must be 10..5000 chars' });
    }
    fields.push(`description = $${i++}`);
    values.push(description);
  }

  if (req.body.priceCents !== undefined) {
    const v = req.body.priceCents;
    if (v !== null && (!Number.isInteger(v) || v < 0)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'priceCents must be integer >= 0 or null' });
    }
    fields.push(`price_cents = $${i++}`);
    values.push(v);
  }

  if (req.body.locationId !== undefined) {
    const locationId = String(req.body.locationId || '').trim();
    if (!isUuid(locationId)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId must be a UUID' });
    }
    fields.push(`location_id = $${i++}`);
    values.push(locationId);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'no fields to update' });
  }

  values.push(adId);
  values.push(userId);

  try {
    const r = await pool.query(
      `
      UPDATE ads
      SET ${fields.join(', ')}
      WHERE id = $${i++}
        AND user_id = $${i++}
        AND status = 'draft'
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      values
    );

    if (r.rowCount === 0) {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'only own draft ads can be edited'
      });
    }

    return res.json(r.rows[0]);
  } catch (err) {
    if (err && err.code === '23503') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId does not exist' });
    }
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * POST /api/ads/:id/publish
 * requires auth
 */
async function publishAd(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  try {
    const r = await pool.query(
      `
      UPDATE ads
      SET status = 'active',
          published_at = now(),
          stopped_at = NULL
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [adId, userId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * POST /api/ads/:id/stop
 * requires auth
 */
async function stopAd(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  try {
    const r = await pool.query(
      `
      UPDATE ads
      SET status = 'stopped',
          stopped_at = now()
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [adId, userId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * GET /api/ads/my
 * requires auth
 */
async function listMyAds(req, res) {
  const userId = req.user?.id;
  const status = req.query.status ? String(req.query.status) : null;

  const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
  const offset = Math.max(0, toInt(req.query.offset, 0));

  const values = [userId];
  let where = 'WHERE a.user_id = $1';

  if (status) {
    if (!['draft', 'active', 'stopped'].includes(status)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'invalid status filter' });
    }
    values.push(status);
    where += ` AND a.status = $${values.length}`;
  }

  values.push(limit);
  values.push(offset);

  const sql = `
    SELECT
      a.id, a.user_id, a.location_id,
      l.country, l.city, l.district,
      a.title, a.description, a.price_cents,
      a.status, a.created_at, a.published_at, a.stopped_at
    FROM ads a
    JOIN locations l ON l.id = a.location_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $${values.length - 1}
    OFFSET $${values.length}
  `;

  try {
    const r = await pool.query(sql, values);
    return res.json(r.rows);
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * GET /api/ads (feed)
 * query: locationId=<uuid> (required for MVP feed)
 */
async function listFeed(req, res) {
  const locationId = String(req.query.locationId || '').trim();

  if (!isUuid(locationId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId (UUID) is required' });
  }

  const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
  const offset = Math.max(0, toInt(req.query.offset, 0));

  try {
    const r = await pool.query(
      `
      SELECT
        a.id, a.location_id,
        l.country, l.city, l.district,
        a.title, a.description, a.price_cents,
        a.status, a.created_at, a.published_at
      FROM ads a
      JOIN locations l ON l.id = a.location_id
      WHERE a.location_id = $1
        AND a.status = 'active'
      ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [locationId, limit, offset]
    );

    return res.json(r.rows);
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

module.exports = {
  createDraft,
  updateDraft,
  publishAd,
  stopAd,
  listMyAds,
  listFeed
};
