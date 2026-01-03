'use strict';

/**
 * ads.create.lifecycle.js
 * 1:1 extract of createDraft DB insert (validation stays in controller)
 *
 * Returns: inserted ad row
 * Throws: { status, body } for known responses
 */

const pool = require('../../db/pool');
const { ERROR_CODES } = require('../../utils/errorCodes');

function httpError(status, body) {
  const e = new Error(body?.message || body?.error || 'ERROR');
  e.status = status;
  e.body = body;
  return e;
}

async function createDraftTx({ userId, locationId, title, description, priceCents }) {
  try {
    const r = await pool.query(
      `
      INSERT INTO ads (user_id, location_id, title, description, price_cents, status)
      VALUES ($1, $2, $3, $4, $5, 'draft')
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
      `,
      [userId, locationId, title, description, priceCents]
    );

    return r.rows[0];
  } catch (err) {
    if (err && err.code === '23503') {
      throw httpError(400, {
        error: ERROR_CODES.BAD_REQUEST,
        message: 'locationId does not exist'
      });
    }
    throw httpError(500, { error: ERROR_CODES.DB_ERROR, message: String(err?.message || err) });
  }
}

module.exports = {
  createDraftTx
};
