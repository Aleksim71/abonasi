'use strict';

const pool = require('../../config/db');
const { isUuid } = require('../../utils/validation');
const { mapAdRowToDto } = require('./ads.mapper');

/**
 * Helpers
 */
function notFound(res) {
  return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
}

/**
 * CREATE DRAFT
 */
async function createDraft(req, res) {
  const userId = req.user.id;
  const { locationId, title, description, priceCents = null } = req.body;

  const q = `
    INSERT INTO ads (owner_id, location_id, title, description, price_cents, status)
    VALUES ($1,$2,$3,$4,$5,'draft')
    RETURNING *
  `;

  const { rows } = await pool.query(q, [
    userId,
    locationId,
    title,
    description,
    priceCents
  ]);

  return res.status(201).json({
    data: {
      ad: mapAdRowToDto(rows[0])
    }
  });
}

/**
 * PUBLISH
 */
async function publishAd(req, res) {
  const userId = req.user.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be UUID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cur = await client.query(
      `
      SELECT *
      FROM ads
      WHERE id = $1
      FOR UPDATE
      `,
      [adId]
    );

    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return notFound(res);
    }

    const ad = cur.rows[0];

    if (String(ad.owner_id) !== String(userId)) {
      await client.query('ROLLBACK');
      return notFound(res);
    }

    if (ad.status !== 'draft') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'only draft ad can be published'
      });
    }

    const photos = await client.query(
      `SELECT 1 FROM ad_photos WHERE ad_id = $1 LIMIT 1`,
      [adId]
    );

    if (photos.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'draft must have at least one photo'
      });
    }

    await client.query(
      `
      UPDATE ads
      SET status='active',
          published_at = NOW()
      WHERE id = $1
      `,
      [adId]
    );

    const fresh = await client.query(`SELECT * FROM ads WHERE id=$1`, [adId]);

    await client.query('COMMIT');

    return res.json({
      data: {
        ad: mapAdRowToDto(fresh.rows[0])
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'DB_ERROR', message: e.message });
  } finally {
    client.release();
  }
}

/**
 * STOP
 */
async function stopAd(req, res) {
  const userId = req.user.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be UUID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 🔑 bypass trigger
    await client.query(`SELECT set_config('app.allow_non_draft_update','1', true)`);

    const cur = await client.query(
      `SELECT * FROM ads WHERE id=$1 FOR UPDATE`,
      [adId]
    );

    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return notFound(res);
    }

    const ad = cur.rows[0];

    if (String(ad.owner_id) !== String(userId)) {
      await client.query('ROLLBACK');
      return notFound(res);
    }

    if (ad.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'only active ad can be stopped'
      });
    }

    await client.query(
      `
      UPDATE ads
      SET status='stopped',
          stopped_at = NOW()
      WHERE id=$1
      `,
      [adId]
    );

    const fresh = await client.query(`SELECT * FROM ads WHERE id=$1`, [adId]);

    await client.query('COMMIT');

    return res.json({
      data: {
        ad: mapAdRowToDto(fresh.rows[0])
      }
    });
  } catch (e) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'DB_ERROR', message: e.message });
  } finally {
    client.release();
  }
}

/**
 * 🔁 RESTART  (D2 — FIXED)
 */
async function restartAd(req, res) {
  const userId = req.user.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be UUID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 🔑 bypass "only draft can be updated" trigger
    await client.query(`SELECT set_config('app.allow_non_draft_update','1', true)`);

    const cur = await client.query(
      `
      SELECT *
      FROM ads
      WHERE id=$1
      FOR UPDATE
      `,
      [adId]
    );

    if (cur.rowCo
