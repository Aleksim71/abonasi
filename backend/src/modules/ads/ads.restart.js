'use strict';

/**
 * POST /api/ads/:id/restart
 * requires auth
 *
 * Rule (already in suite):
 * - only owner
 * - only stopped AND not replaced (replaced_by_ad_id must be null)
 * - restart sets status=active, stopped_at=null
 *
 * Important: bypass DB trigger ads_prevent_update_non_draft inside transaction:
 *   SELECT set_config('app.allow_non_draft_update','1', true)
 */

const pool = require('../db/pool'); // <-- adjust if your pool path differs
const { isUuid } = require('../utils/validation'); // <-- adjust
const { mapAdRowToDto } = require('../mappers/ad'); // <-- adjust (or inline mapping)

async function restartAd(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ✅ bypass "only draft can be updated" trigger inside this transaction
    await client.query(`SELECT set_config('app.allow_non_draft_update','1', true)`);

    // lock row to avoid races
    const cur = await client.query(
      `
      SELECT id, owner_id, status, replaced_by_ad_id
      FROM ads
      WHERE id = $1
      FOR UPDATE
      `,
      [adId]
    );

    if (cur.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    const row = cur.rows[0];

    // non-owner -> 404 (as in your other rules)
    if (String(row.owner_id) !== String(userId)) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    // rule: replaced stopped cannot be restarted
    if (row.replaced_by_ad_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'CONFLICT',
        message: 'replaced stopped ad cannot be restarted'
      });
    }

    // rule: only stopped (not draft/active/replaced)
    if (row.status !== 'stopped') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'CONFLICT',
        message: `cannot restart ad in status=${row.status}`
      });
    }

    // do restart
    await client.query(
      `
      UPDATE ads
      SET status = 'active',
          stopped_at = NULL
      WHERE id = $1
      `,
      [adId]
    );

    // fetch updated row for response
    const fresh = await client.query(
      `
      SELECT *
      FROM ads
      WHERE id = $1
      `,
      [adId]
    );

    await client.query('COMMIT');

    const adDto = mapAdRowToDto(fresh.rows[0]);

    return res.status(200).json({
      data: {
        ad: adDto,
        notice: {
          code: 'AD_RESTARTED',
          message: 'Ad restarted and is now active'
        }
      }
    });
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // ignore rollback errors
    }

    // keep your existing error wrapper if you have one; this is a safe default
    return res.status(500).json({
      error: 'DB_ERROR',
      message: e?.message || 'unknown db error'
    });
  } finally {
    client.release();
  }
}

module.exports = { restartAd };
