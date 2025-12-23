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
  if (title.length < 3 || title.length > 120) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'title must be 3..120 chars' });
  }
  if (description.length < 10 || description.length > 5000) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'description must be 10..5000 chars' });
  }
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

      // убрать служебные поля из ответа
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
 * body: { filePath, sortOrder? }
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
 * body: { items: [{ photoId, sortOrder }] }
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

    // ✅ STEP 1: temporary shift to avoid UNIQUE(ad_id, sort_order) conflicts
    await client.query(
      `UPDATE ad_photos SET sort_order = sort_order + 100 WHERE ad_id = $1`,
      [adId]
    );

    // ✅ STEP 2: apply final sort orders
    for (const it of items) {
      await client.query(
        `UPDATE ad_photos SET sort_order = $1 WHERE id = $2 AND ad_id = $3`,
        [it.sortOrder, it.photoId, adId]
      );
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
  updateDraft,
  publishAd,
  stopAd,
  listMyAds,
  listFeed,
  getAdById,
  addPhotoToDraft,
  deletePhotoFromDraft,
  reorderPhotosInDraft
};
