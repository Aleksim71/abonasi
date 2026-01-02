'use strict';

const { txError } = require('../../utils/httpError');

/**
 * ads.fork.lifecycle.js
 * Extracted fork-branch from updateAd (non-draft -> create new ad + copy photos + replace old).
 *
 * IMPORTANT:
 * - does NOT BEGIN/COMMIT/ROLLBACK (controller owns transaction)
 * - throws TxError (err.status + err.body) for early exits (controller will ROLLBACK + respond)
 */

async function forkNonDraft({ client, userId, adId, oldAd, patch }) {
  const forkTargetStatus = oldAd.status === 'active' ? 'active' : 'draft';

  // ✅ bypass trigger for non-draft updates (LOCAL for this tx)
  await client.query(`SET LOCAL app.allow_non_draft_update = '1'`);

  if (forkTargetStatus === 'active') {
    const photosCnt = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM ad_photos WHERE ad_id = $1`,
      [adId]
    );

    if ((photosCnt.rows[0]?.cnt ?? 0) === 0) {
      throw txError(409, 'NOT_ALLOWED', 'cannot edit published ad: at least one photo is required');
    }
  }

  const ins = await client.query(
    `
    INSERT INTO ads (
      user_id, location_id, title, description, price_cents,
      status, published_at, stopped_at,
      parent_ad_id
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6::ad_status,
      CASE WHEN $6::ad_status = 'active'::ad_status THEN now() ELSE NULL::timestamptz END,
      NULL::timestamptz,
      $7::uuid
    )
    RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
    `,
    [
      userId,
      patch.location_id,
      patch.title,
      patch.description,
      patch.price_cents,
      forkTargetStatus,
      adId
    ]
  );

  const newAd = ins.rows[0];

  await client.query(
    `
    INSERT INTO ad_photos (ad_id, file_path, sort_order)
    SELECT $1, file_path, sort_order
    FROM ad_photos
    WHERE ad_id = $2
    ORDER BY sort_order ASC, created_at ASC
    `,
    [newAd.id, adId]
  );

  if (oldAd.status === 'active') {
    const stopped = await client.query(
      `
      UPDATE ads
      SET status = 'stopped',
          stopped_at = now(),
          replaced_by_ad_id = $3
      WHERE id = $1 AND user_id = $2 AND status = 'active'
        AND replaced_by_ad_id IS NULL
      `,
      [adId, userId, newAd.id]
    );

    if (!stopped.rowCount) {
      throw txError(409, 'NOT_ALLOWED', 'cannot replace this ad');
    }
  } else {
    const linked = await client.query(
      `
      UPDATE ads
      SET replaced_by_ad_id = $1
      WHERE id = $2 AND user_id = $3 AND status = 'stopped'
        AND replaced_by_ad_id IS NULL
      `,
      [newAd.id, adId, userId]
    );

    if (!linked.rowCount) {
      throw txError(409, 'NOT_ALLOWED', 'cannot replace this ad');
    }
  }

  const noticeMessage =
    oldAd.status === 'active'
      ? 'This ad was published. A new version has been created and published; the old one has been stopped.'
      : 'This ad was stopped. A new draft version has been created; the old one remains stopped.';

  return { ok: true, newAd, noticeMessage };
}

module.exports = { forkNonDraft };
