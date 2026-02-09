'use strict';

/**
 * ads.stop.lifecycle.js
 * 1:1 extract of stopAd transaction logic from controller
 *
 * Returns: updated ad row (already selected fields via RETURNING)
 * Throws: { status, body } for known responses (controller will send as-is)
 */

const pool = require('../../db/pool');
const { ERROR_CODES } = require('../../utils/errorCodes');

function httpError(status, body) {
  const e = new Error(body?.message || body?.error || 'ERROR');
  e.status = status;
  e.body = body;
  return e;
}

async function stopAdTx({ userId, adId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // keep exact behavior (uses SET LOCAL, not set_config)
    await client.query(`SET LOCAL app.allow_non_draft_update = '1'`);

    const cur = await client.query(
      `
      SELECT id, status
      FROM ads
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [adId, userId]
    );

    if (!cur.rowCount) {
      await client.query('ROLLBACK');
      throw httpError(404, { error: ERROR_CODES.NOT_FOUND, message: 'ad not found' });
    }

    const ad = cur.rows[0];

    if (ad.status !== 'active') {
      await client.query('ROLLBACK');
      throw httpError(409, {
        error: ERROR_CODES.NOT_ALLOWED,
        message: 'only active ads can be stopped'
      });
    }

    const r = await client.query(
      `
      UPDATE ads
      SET status = 'stopped',
          stopped_at = now()
      WHERE id = $1 AND user_id = $2 AND status = 'active'
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
      `,
      [adId, userId]
    );

    if (!r.rowCount) {
      await client.query('ROLLBACK');
      throw httpError(409, {
        error: ERROR_CODES.NOT_ALLOWED,
        message: 'cannot stop this ad'
      });
    }

    await client.query('COMMIT');
    return r.rows[0];
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* intentionally ignored */
    }

    // preserve special-case behavior
    if (err && err.code === '45000') {
      throw httpError(409, { error: ERROR_CODES.NOT_ALLOWED, message: String(err.message || err) });
    }

    // bubble known http errors as-is
    if (err && err.status && err.body) throw err;

    throw httpError(500, { error: ERROR_CODES.DB_ERROR, message: String(err?.message || err) });
  } finally {
    client.release();
  }
}

module.exports = {
  stopAdTx
};
