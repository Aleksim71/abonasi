'use strict';

/**
 * Extract draft-update branch from updateAd.
 * Controller owns transaction BEGIN/COMMIT/ROLLBACK.
 */

async function updateDraftAd({ client, userId, adId, patch }) {
  const r = await client.query(
    `
    UPDATE ads
    SET
      location_id = $1,
      title = $2,
      description = $3,
      price_cents = $4
    WHERE id = $5
      AND user_id = $6
      AND status = 'draft'
    RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
    `,
    [patch.location_id, patch.title, patch.description, patch.price_cents, adId, userId]
  );

  if (!r.rowCount) {
    return {
      ok: false,
      status: 409,
      body: { error: 'NOT_ALLOWED', message: 'only own draft ads can be edited' }
    };
  }

  return { ok: true, row: r.rows[0] };
}

module.exports = { updateDraftAd };
