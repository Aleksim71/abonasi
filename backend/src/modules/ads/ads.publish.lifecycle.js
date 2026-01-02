'use strict';

/**
 * ads.publish.lifecycle.js
 * 1:1 extract of publishAd logic from controller (no transaction, uses pool.query)
 *
 * Returns: updated ad row (RETURNING fields)
 * Throws: { status, body } for known responses
 */

const pool = require('../../db/pool');

function httpError(status, body) {
  const e = new Error(body?.message || body?.error || 'ERROR');
  e.status = status;
  e.body = body;
  return e;
}

async function publishAdTx({ userId, adId }) {
  try {
    const cur = await pool.query(
      `
      SELECT id, status, title, description
      FROM ads
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [adId, userId]
    );

    if (!cur.rowCount) {
      throw httpError(404, { error: 'NOT_FOUND', message: 'ad not found' });
    }

    const ad = cur.rows[0];

    if (ad.status !== 'draft') {
      throw httpError(409, {
        error: 'NOT_ALLOWED',
        message: 'only draft ads can be published'
      });
    }

    const title = String(ad.title || '').trim();
    const description = String(ad.description || '').trim();

    if (title.length < 3 || title.length > 120) {
      throw httpError(409, {
        error: 'NOT_ALLOWED',
        message: 'cannot publish: title must be 3..120 chars'
      });
    }

    if (description.length < 10 || description.length > 5000) {
      throw httpError(409, {
        error: 'NOT_ALLOWED',
        message: 'cannot publish: description must be 10..5000 chars'
      });
    }

    const photos = await pool.query(
      `
      SELECT COUNT(*)::int AS cnt
      FROM ad_photos
      WHERE ad_id = $1
      `,
      [adId]
    );

    if (photos.rows[0].cnt === 0) {
      throw httpError(409, {
        error: 'NOT_ALLOWED',
        message: 'cannot publish: at least one photo is required'
      });
    }

    const r = await pool.query(
      `
      UPDATE ads
      SET status = 'active',
          published_at = now(),
          stopped_at = NULL
      WHERE id = $1 AND user_id = $2 AND status = 'draft'
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
      `,
      [adId, userId]
    );

    if (!r.rowCount) {
      throw httpError(409, {
        error: 'NOT_ALLOWED',
        message: 'cannot publish this ad'
      });
    }

    return r.rows[0];
  } catch (err) {
    if (err && err.status && err.body) throw err;
    throw httpError(500, { error: 'DB_ERROR', message: String(err?.message || err) });
  }
}

module.exports = {
  publishAdTx
};
