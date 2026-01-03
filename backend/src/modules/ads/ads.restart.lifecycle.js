'use strict';

/**
 * ads.restart.lifecycle.js
 * 1:1 extract of restartAd transaction logic from controller
 * - keeps same business rules
 * - keeps same "do not leak" behavior (404 for non-owner)
 * - keeps same trigger bypass via set_config(..., true)
 *
 * Returns: fresh ad row (DB shape) on success
 * Throws: { status, body } on known cases
 */

const pool = require('../../db/pool');
const { ERROR_CODES } = require('../../utils/errorCodes');

function httpError(status, body) {
  const e = new Error(body?.message || body?.error || 'ERROR');
  e.status = status;
  e.body = body;
  return e;
}

async function restartAdTx({ userId, adId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 🔑 bypass trigger "Only draft ads can be updated" (LOCAL for this transaction)
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

    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      throw httpError(404, { error: ERROR_CODES.NOT_FOUND, message: 'ad not found' });
    }

    const ad = cur.rows[0];

    // ownership check (do not leak)
    if (!userId || String(ad.user_id) !== String(userId)) {
      await client.query('ROLLBACK');
      throw httpError(404, { error: ERROR_CODES.NOT_FOUND, message: 'ad not found' });
    }

    // contract rules
    if (ad.status === 'draft') {
      await client.query('ROLLBACK');
      throw httpError(409, { error: ERROR_CODES.NOT_ALLOWED, message: 'cannot restart draft' });
    }
    if (ad.status === 'active') {
      await client.query('ROLLBACK');
      throw httpError(409, { error: ERROR_CODES.NOT_ALLOWED, message: 'cannot restart active ad' });
    }
    if (ad.status !== 'stopped') {
      await client.query('ROLLBACK');
      throw httpError(409, {
        error: ERROR_CODES.NOT_ALLOWED,
        message: 'cannot restart in this state'
      });
    }
    if (ad.replaced_by_ad_id) {
      await client.query('ROLLBACK');
      throw httpError(409, { error: ERROR_CODES.NOT_ALLOWED, message: 'cannot restart replaced ad' });
    }

    // ✅ IMPORTANT: UPDATE must run on SAME client in SAME tx
    await client.query(
      `
      UPDATE ads
      SET status='active',
          stopped_at=NULL
      WHERE id=$1
      `,
      [adId]
    );

    const fresh = await client.query('SELECT * FROM ads WHERE id=$1', [adId]);

    await client.query('COMMIT');
    return fresh.rows[0];
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {}

    // bubble known http errors as-is
    if (e && e.status && e.body) throw e;

    // unknown db error -> align with controller contract
    throw httpError(500, { error: ERROR_CODES.DB_ERROR, message: e?.message || 'db error' });
  } finally {
    client.release();
  }
}

module.exports = {
  restartAdTx
};
