'use strict';

const pool = require('../../config/db');

function isUuid(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

function toInt(v, def) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function validateTitle(title) {
  const t = String(title || '').trim();
  if (t.length < 3 || t.length > 120) return { ok: false, value: t, message: 'title must be 3..120 chars' };
  return { ok: true, value: t };
}

function validateDescription(description) {
  const d = String(description || '').trim();
  if (d.length < 10 || d.length > 5000) return { ok: false, value: d, message: 'description must be 10..5000 chars' };
  return { ok: true, value: d };
}

function validatePriceCents(v) {
  if (v === null) return { ok: true, value: null };
  if (v === undefined) return { ok: true, value: undefined };
  if (!Number.isInteger(v) || v < 0) return { ok: false, value: v, message: 'priceCents must be integer >= 0 or null' };
  return { ok: true, value: v };
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
  const priceCents =
    priceCentsRaw === null || priceCentsRaw === undefined || priceCentsRaw === ''
      ? null
      : Number(priceCentsRaw);

  if (!isUuid(locationId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId must be a UUID' });
  }

  const vt = validateTitle(title);
  if (!vt.ok) return res.status(400).json({ error: 'BAD_REQUEST', message: vt.message });

  const vd = validateDescription(description);
  if (!vd.ok) return res.status(400).json({ error: 'BAD_REQUEST', message: vd.message });

  if (priceCents !== null && (!Number.isInteger(priceCents) || priceCents < 0)) {
    return res
      .status(400)
      .json({ error: 'BAD_REQUEST', message: 'priceCents must be a non-negative integer or null' });
  }

  try {
    const r = await pool.query(
      `
      INSERT INTO ads (user_id, location_id, title, description, price_cents, status)
      VALUES ($1, $2, $3, $4, $5, 'draft')
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [userId, locationId, vt.value, vd.value, priceCents]
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
 *
 * ✅ Draft: обычная правка
 * ✅ Active/Stopped: "редакция" = создание нового (fork) (+ stop old if active)
 *
 * body (any subset):
 * - title
 * - description
 * - priceCents (number | null)
 * - locationId (uuid)
 */
async function updateAd(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  // 1) load current ad state (only own)
  let cur;
  try {
    cur = await pool.query(
      `
      SELECT id, user_id, status, location_id, title, description, price_cents, published_at
      FROM ads
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [adId, userId]
    );
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }

  if (!cur.rowCount) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
  }

  const oldAd = cur.rows[0];

  // 2) build next values = old + patch
  const patch = {
    location_id: oldAd.location_id,
    title: oldAd.title,
    description: oldAd.description,
    price_cents: oldAd.price_cents
  };

  if (req.body.locationId !== undefined) {
    const locationId = String(req.body.locationId || '').trim();
    if (!isUuid(locationId)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId must be a UUID' });
    }
    patch.location_id = locationId;
  }

  if (req.body.title !== undefined) {
    const vt = validateTitle(req.body.title);
    if (!vt.ok) return res.status(400).json({ error: 'BAD_REQUEST', message: vt.message });
    patch.title = vt.value;
  } else {
    const vt = validateTitle(patch.title);
    if (!vt.ok) return res.status(409).json({ error: 'NOT_ALLOWED', message: 'cannot edit: invalid existing title' });
    patch.title = vt.value;
  }

  if (req.body.description !== undefined) {
    const vd = validateDescription(req.body.description);
    if (!vd.ok) return res.status(400).json({ error: 'BAD_REQUEST', message: vd.message });
    patch.description = vd.value;
  } else {
    const vd = validateDescription(patch.description);
    if (!vd.ok)
      return res.status(409).json({ error: 'NOT_ALLOWED', message: 'cannot edit: invalid existing description' });
    patch.description = vd.value;
  }

  if (req.body.priceCents !== undefined) {
    const vp = validatePriceCents(req.body.priceCents);
    if (!vp.ok) return res.status(400).json({ error: 'BAD_REQUEST', message: vp.message });
    patch.price_cents = vp.value;
  }

  const hasAnyField =
    req.body.locationId !== undefined ||
    req.body.title !== undefined ||
    req.body.description !== undefined ||
    req.body.priceCents !== undefined;

  if (!hasAnyField) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'no fields to update' });
  }

  // 3) Draft -> normal update
  if (oldAd.status === 'draft') {
    try {
      const r = await pool.query(
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
        RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
        `,
        [patch.location_id, patch.title, patch.description, patch.price_cents, adId, userId]
      );

      if (!r.rowCount) {
        return res.status(409).json({
          error: 'NOT_ALLOWED',
          message: 'only own draft ads can be edited'
        });
      }

      return res.json({
        data: r.rows[0],
        notice: {
          mode: 'updated',
          message: 'Draft ad updated'
        }
      });
    } catch (err) {
      if (err && err.code === '23503') {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId does not exist' });
      }
      return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
    }
  }

  // 4) Active/Stopped -> fork (create new), old is NOT edited
  // Policy:
  // - active  -> new active (published immediately), old becomes stopped
  // - stopped -> new draft (user may publish), old stays stopped
  const forkTargetStatus = oldAd.status === 'active' ? 'active' : 'draft';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 4.1) if new is ACTIVE -> old must have >=1 photo (we copy them)
    if (forkTargetStatus === 'active') {
      const photosCnt = await client.query(`SELECT COUNT(*)::int AS cnt FROM ad_photos WHERE ad_id = $1`, [adId]);
      if ((photosCnt.rows[0]?.cnt ?? 0) === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'NOT_ALLOWED',
          message: 'cannot edit published ad: at least one photo is required'
        });
      }
    }

    // 4.2) create new ad (FIX: explicit casts for enum ad_status + timestamps)
    const ins = await client.query(
      `
      INSERT INTO ads (user_id, location_id, title, description, price_cents, status, published_at, stopped_at)
      VALUES (
        $1, $2, $3, $4, $5,
        $6::ad_status,
        CASE WHEN $6::ad_status = 'active'::ad_status THEN now() ELSE NULL::timestamptz END,
        NULL::timestamptz
      )
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [userId, patch.location_id, patch.title, patch.description, patch.price_cents, forkTargetStatus]
    );

    const newAd = ins.rows[0];

    // 4.3) copy photos
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

    // 4.4) old ACTIVE -> STOP
    if (oldAd.status === 'active') {
      const stopped = await client.query(
        `
        UPDATE ads
        SET status = 'stopped',
            stopped_at = now()
        WHERE id = $1 AND user_id = $2 AND status = 'active'
        `,
        [adId, userId]
      );

      if (!stopped.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'NOT_ALLOWED', message: 'cannot replace this ad' });
      }
    }

    await client.query('COMMIT');

    const noticeMessage =
      oldAd.status === 'active'
        ? 'This ad was published. A new version has been created and published; the old one has been stopped.'
        : 'This ad was stopped. A new draft version has been created; the old one remains stopped.';

    return res.json({
      data: {
        mode: 'forked',
        oldAdId: adId,
        newAdId: newAd.id,
        newStatus: newAd.status,
        ad: newAd
      },
      notice: {
        mode: 'forked',
        message: noticeMessage
      }
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    if (err && err.code === '23503') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId does not exist' });
    }

    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  } finally {
    client.release();
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
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    const ad = cur.rows[0];

    if (ad.status !== 'draft') {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'only draft ads can be published'
      });
    }

    const title = String(ad.title || '').trim();
    const description = String(ad.description || '').trim();

    if (title.length < 3 || title.length > 120) {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'cannot publish: title must be 3..120 chars'
      });
    }

    if (description.length < 10 || description.length > 5000) {
      return res.status(409).json({
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
      return res.status(409).json({
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
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [adId, userId]
    );

    if (!r.rowCount) {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'cannot publish this ad'
      });
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
    const cur = await pool.query(
      `
      SELECT id, status
      FROM ads
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [adId, userId]
    );

    if (!cur.rowCount) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    const ad = cur.rows[0];

    if (ad.status !== 'active') {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'only active ads can be stopped'
      });
    }

    const r = await pool.query(
      `
      UPDATE ads
      SET status = 'stopped',
          stopped_at = now()
      WHERE id = $1 AND user_id = $2 AND status = 'active'
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [adId, userId]
    );

    if (!r.rowCount) {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'cannot stop this ad'
      });
    }

    return res.json(r.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * POST /api/ads/:id/restart
 * requires auth
 */
async function restartAd(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  try {
    const cur = await pool.query(
      `
      SELECT id, status
      FROM ads
      WHERE id = $1 AND user_id = $2
      LIMIT 1
      `,
      [adId, userId]
    );

    if (!cur.rowCount) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    const ad = cur.rows[0];

    if (ad.status !== 'stopped') {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'only stopped ads can be restarted'
      });
    }

    const r = await pool.query(
      `
      UPDATE ads
      SET status = 'active',
          stopped_at = NULL
      WHERE id = $1 AND user_id = $2 AND status = 'stopped'
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at
      `,
      [adId, userId]
    );

    if (!r.rowCount) {
      return res.status(409).json({ error: 'NOT_ALLOWED', message: 'cannot restart this ad' });
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
 * returns: previewPhoto + photosCount
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
        a.id,
        a.location_id,
        l.country, l.city, l.district,
        a.title, a.description, a.price_cents,
        a.status, a.created_at, a.published_at,

        -- preview photo (first by sort_order)
        p.id         AS "previewPhotoId",
        p.file_path  AS "previewPhotoFilePath",
        p.sort_order AS "previewPhotoSortOrder",

        -- total photos count
        COALESCE(pc.photos_count, 0)::int AS "photosCount"
      FROM ads a
      JOIN locations l ON l.id = a.location_id

      LEFT JOIN LATERAL (
        SELECT id, file_path, sort_order
        FROM ad_photos
        WHERE ad_id = a.id
        ORDER BY sort_order ASC, created_at ASC
        LIMIT 1
      ) p ON true

      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS photos_count
        FROM ad_photos
        WHERE ad_id = a.id
      ) pc ON true

      WHERE a.location_id = $1
        AND a.status = 'active'
      ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [locationId, limit, offset]
    );

    const rows = r.rows.map((row) => {
      const previewPhoto = row.previewPhotoId
        ? {
            id: row.previewPhotoId,
            filePath: row.previewPhotoFilePath,
            sortOrder: row.previewPhotoSortOrder
          }
        : null;

      // eslint-disable-next-line no-unused-vars
      const { previewPhotoId, previewPhotoFilePath, previewPhotoSortOrder, ...rest } = row;

      return { ...rest, previewPhoto };
    });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * GET /api/ads/:id (public card)
 * - public: only active
 * - owner: any status
 */
async function getAdById(req, res) {
  const adId = String(req.params.id || '').trim();
  const viewerUserId = req.user?.id ?? null;

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  try {
    const adRes = await pool.query(
      `
      SELECT
        a.id, a.user_id, a.location_id,
        l.country, l.city, l.district,
        a.title, a.description, a.price_cents,
        a.status, a.created_at, a.published_at, a.stopped_at
      FROM ads a
      JOIN locations l ON l.id = a.location_id
      WHERE a.id = $1
      LIMIT 1
      `,
      [adId]
    );

    if (!adRes.rowCount) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const ad = adRes.rows[0];
    const isOwner = viewerUserId && String(viewerUserId) === String(ad.user_id);

    if (!isOwner && ad.status !== 'active') {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const photosRes = await pool.query(
      `
      SELECT
        id,
        file_path AS "filePath",
        sort_order AS "sortOrder",
        created_at AS "createdAt"
      FROM ad_photos
      WHERE ad_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [adId]
    );

    return res.json({
      data: {
        ...ad,
        isOwner: Boolean(isOwner),
        photos: photosRes.rows
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * POST /api/ads/:id/photos
 * requires auth
 * MVP: only owner + only draft
 */
async function addPhotoToDraft(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  const filePath = String(req.body.filePath || '').trim();
  const sortOrderRaw = req.body.sortOrder;
  const sortOrder = sortOrderRaw === undefined || sortOrderRaw === null ? 0 : Number(sortOrderRaw);

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }
  if (!filePath || filePath.length < 3 || filePath.length > 500) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'filePath must be 3..500 chars' });
  }
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 50) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'sortOrder must be integer 0..50' });
  }

  try {
    const adCheck = await pool.query(
      `SELECT id FROM ads WHERE id = $1 AND user_id = $2 AND status = 'draft' LIMIT 1`,
      [adId, userId]
    );

    if (!adCheck.rowCount) {
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'only own draft ads can be edited'
      });
    }

    try {
      await pool.query(
        `
        INSERT INTO ad_photos (ad_id, file_path, sort_order)
        VALUES ($1, $2, $3)
        `,
        [adId, filePath, sortOrder]
      );
    } catch (e) {
      if (e && e.code === '23505') {
        return res.status(409).json({
          error: 'CONFLICT',
          message: 'photo with this sortOrder already exists'
        });
      }
      throw e;
    }

    const photosRes = await pool.query(
      `
      SELECT
        id,
        file_path AS "filePath",
        sort_order AS "sortOrder",
        created_at AS "createdAt"
      FROM ad_photos
      WHERE ad_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [adId]
    );

    return res.status(201).json({
      data: {
        adId,
        photos: photosRes.rows
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * DELETE /api/ads/:id/photos/:photoId
 * requires auth
 * MVP: only owner + only draft
 */
async function deletePhotoFromDraft(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();
  const photoId = String(req.params.photoId || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }
  if (!isUuid(photoId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'photo id must be a UUID' });
  }

  try {
    const adCheck = await pool.query(
      `SELECT id FROM ads WHERE id = $1 AND user_id = $2 AND status = 'draft' LIMIT 1`,
      [adId, userId]
    );
    if (!adCheck.rowCount) {
      return res.status(409).json({ error: 'NOT_ALLOWED', message: 'only own draft ads can be edited' });
    }

    const del = await pool.query(
      `DELETE FROM ad_photos WHERE id = $1 AND ad_id = $2 RETURNING id`,
      [photoId, adId]
    );
    if (!del.rowCount) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'photo not found' });
    }

    const photosRes = await pool.query(
      `
      SELECT
        id,
        file_path AS "filePath",
        sort_order AS "sortOrder",
        created_at AS "createdAt"
      FROM ad_photos
      WHERE ad_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [adId]
    );

    return res.json({ data: { adId, photos: photosRes.rows } });
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * PUT /api/ads/:id/photos/reorder
 * requires auth
 * MVP: only owner + only draft
 */
async function reorderPhotosInDraft(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();
  const items = req.body?.items;

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'items must be a non-empty array' });
  }

  for (const it of items) {
    const photoId = String(it?.photoId || '').trim();
    const sortOrder = Number(it?.sortOrder);

    if (!isUuid(photoId)) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'each item.photoId must be UUID' });
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 50) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'each item.sortOrder must be integer 0..50' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const adCheck = await client.query(
      `SELECT id FROM ads WHERE id = $1 AND user_id = $2 AND status = 'draft' LIMIT 1`,
      [adId, userId]
    );
    if (!adCheck.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'NOT_ALLOWED', message: 'only own draft ads can be edited' });
    }

    const ids = items.map((x) => String(x.photoId).trim());
    const own = await client.query(
      `SELECT id FROM ad_photos WHERE ad_id = $1 AND id = ANY($2::uuid[])`,
      [adId, ids]
    );
    if (own.rowCount !== ids.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'some photoIds do not belong to this ad' });
    }

    // temporary shift to avoid UNIQUE(ad_id, sort_order) conflicts
    await client.query(`UPDATE ad_photos SET sort_order = sort_order + 100 WHERE ad_id = $1`, [adId]);

    for (const it of items) {
      await client.query(`UPDATE ad_photos SET sort_order = $1 WHERE id = $2 AND ad_id = $3`, [
        it.sortOrder,
        it.photoId,
        adId
      ]);
    }

    await client.query('COMMIT');

    const photosRes = await pool.query(
      `
      SELECT
        id,
        file_path AS "filePath",
        sort_order AS "sortOrder",
        created_at AS "createdAt"
      FROM ad_photos
      WHERE ad_id = $1
      ORDER BY sort_order ASC, created_at ASC
      `,
      [adId]
    );

    return res.json({ data: { adId, photos: photosRes.rows } });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}

    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  } finally {
    client.release();
  }
}

module.exports = {
  createDraft,
  updateAd,
  publishAd,
  stopAd,
  restartAd,
  listMyAds,
  listFeed,
  getAdById,
  addPhotoToDraft,
  deletePhotoFromDraft,
  reorderPhotosInDraft
};
