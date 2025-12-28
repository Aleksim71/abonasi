'use strict';

const { pool } = require('../../config/db');

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
  if (t.length < 3 || t.length > 120)
    return { ok: false, value: t, message: 'title must be 3..120 chars' };
  return { ok: true, value: t };
}

function validateDescription(description) {
  const d = String(description || '').trim();
  if (d.length < 10 || d.length > 5000)
    return { ok: false, value: d, message: 'description must be 10..5000 chars' };
  return { ok: true, value: d };
}

function validatePriceCents(v) {
  if (v === null) return { ok: true, value: null };
  if (v === undefined) return { ok: true, value: undefined };
  if (!Number.isInteger(v) || v < 0)
    return { ok: false, value: v, message: 'priceCents must be integer >= 0 or null' };
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
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
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
 */
async function updateAd(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  const hasAnyField =
    req.body.locationId !== undefined ||
    req.body.title !== undefined ||
    req.body.description !== undefined ||
    req.body.priceCents !== undefined;

  if (!hasAnyField) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'no fields to update' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cur = await client.query(
      `
      SELECT id, user_id, status, location_id, title, description, price_cents, published_at, replaced_by_ad_id
      FROM ads
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [adId, userId]
    );

    if (!cur.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    const oldAd = cur.rows[0];

    if (oldAd.replaced_by_ad_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'NOT_ALLOWED', message: 'this ad is already replaced' });
    }

    const patch = {
      location_id: oldAd.location_id,
      title: oldAd.title,
      description: oldAd.description,
      price_cents: oldAd.price_cents
    };

    if (req.body.locationId !== undefined) {
      const locationId = String(req.body.locationId || '').trim();
      if (!isUuid(locationId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId must be a UUID' });
      }
      patch.location_id = locationId;
    }

    if (req.body.title !== undefined) {
      const vt = validateTitle(req.body.title);
      if (!vt.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'BAD_REQUEST', message: vt.message });
      }
      patch.title = vt.value;
    } else {
      const vt = validateTitle(patch.title);
      if (!vt.ok) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'NOT_ALLOWED', message: 'cannot edit: invalid existing title' });
      }
      patch.title = vt.value;
    }

    if (req.body.description !== undefined) {
      const vd = validateDescription(req.body.description);
      if (!vd.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'BAD_REQUEST', message: vd.message });
      }
      patch.description = vd.value;
    } else {
      const vd = validateDescription(patch.description);
      if (!vd.ok) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'NOT_ALLOWED', message: 'cannot edit: invalid existing description' });
      }
      patch.description = vd.value;
    }

    // ✅ A) normalize priceCents: allow "", null, "123"
    if (req.body.priceCents !== undefined) {
      const raw = req.body.priceCents;

      const normalized =
        raw === null || raw === ''
          ? null
          : typeof raw === 'string'
            ? Number(raw)
            : raw;

      const vp = validatePriceCents(normalized);
      if (!vp.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'BAD_REQUEST', message: vp.message });
      }
      patch.price_cents = vp.value;
    }

    if (oldAd.status === 'draft') {
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
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'NOT_ALLOWED', message: 'only own draft ads can be edited' });
      }

      await client.query('COMMIT');
      return res.json({
        data: r.rows[0],
        notice: { mode: 'updated', message: 'Draft ad updated' }
      });
    }

    const forkTargetStatus = oldAd.status === 'active' ? 'active' : 'draft';

    // ✅ bypass trigger for non-draft updates
    await client.query(`SET LOCAL app.allow_non_draft_update = '1'`);

    if (forkTargetStatus === 'active') {
      const photosCnt = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM ad_photos WHERE ad_id = $1`,
        [adId]
      );
      if ((photosCnt.rows[0]?.cnt ?? 0) === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'NOT_ALLOWED',
          message: 'cannot edit published ad: at least one photo is required'
        });
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
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'NOT_ALLOWED', message: 'cannot replace this ad' });
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
      notice: { mode: 'forked', message: noticeMessage }
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback error
    }

    if (err && err.code === '23503') {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'locationId does not exist' });
    }

    if (err && err.code === '45000') {
      return res.status(409).json({ error: 'NOT_ALLOWED', message: String(err.message || err) });
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
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
      return res.status(404).json({ error: 'NOT_FOUND', message: 'ad not found' });
    }

    const ad = cur.rows[0];

    if (ad.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'NOT_ALLOWED',
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
      return res.status(409).json({
        error: 'NOT_ALLOWED',
        message: 'cannot stop this ad'
      });
    }

    await client.query('COMMIT');
    return res.json(r.rows[0]);
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback error
    }

    if (err && err.code === '45000') {
      return res.status(409).json({ error: 'NOT_ALLOWED', message: String(err.message || err) });
    }

    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  } finally {
    client.release();
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
      RETURNING id, user_id, location_id, title, description, price_cents, status, created_at, published_at, stopped_at, parent_ad_id, replaced_by_ad_id
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
      a.status, a.created_at, a.published_at, a.stopped_at,
      a.parent_ad_id, a.replaced_by_ad_id
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
        a.status, a.created_at, a.published_at, a.stopped_at,
        a.parent_ad_id, a.replaced_by_ad_id
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
 * GET /api/ads/:id/versions
 * - public: only if this ad is active
 * - owner: any status
 *
 * returns timeline: oldest-parent ... current ... replaced chain
 *
 * ✅ Timeline UX additions:
 * - data.latestPublishedAdId
 * - timeline[].isLatestPublished
 * - public (non-owner): timeline filtered to active only (no draft/stopped leak)
 */
async function getAdVersions(req, res) {
  const adId = String(req.params.id || '').trim();
  const viewerUserId = req.user?.id ?? null;

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  try {
    // 1) base ad + access
    const base = await pool.query(
      `
      SELECT a.id, a.user_id, a.status
      FROM ads a
      WHERE a.id = $1
      LIMIT 1
      `,
      [adId]
    );

    if (!base.rowCount) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    const cur = base.rows[0];
    const isOwner = viewerUserId && String(viewerUserId) === String(cur.user_id);

    if (!isOwner && cur.status !== 'active') {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    // 2) find root (oldest parent)
    const rootRes = await pool.query(
      `
      WITH RECURSIVE up AS (
        SELECT id, parent_ad_id, replaced_by_ad_id, 0 AS depth
        FROM ads
        WHERE id = $1

        UNION ALL

        SELECT a.id, a.parent_ad_id, a.replaced_by_ad_id, up.depth + 1
        FROM ads a
        JOIN up ON up.parent_ad_id = a.id
        WHERE up.depth < 50
      )
      SELECT id
      FROM up
      ORDER BY depth DESC
      LIMIT 1
      `,
      [adId]
    );

    const rootId = rootRes.rows[0]?.id || adId;

    // 3) walk forward from root by replaced_by_ad_id
    const chainRes = await pool.query(
      `
      WITH RECURSIVE chain AS (
        SELECT
          a.id, a.user_id, a.location_id,
          l.country, l.city, l.district,
          a.title, a.description, a.price_cents,
          a.status, a.created_at, a.published_at, a.stopped_at,
          a.parent_ad_id, a.replaced_by_ad_id,
          0 AS depth
        FROM ads a
        JOIN locations l ON l.id = a.location_id
        WHERE a.id = $1

        UNION ALL

        SELECT
          n.id, n.user_id, n.location_id,
          l2.country, l2.city, l2.district,
          n.title, n.description, n.price_cents,
          n.status, n.created_at, n.published_at, n.stopped_at,
          n.parent_ad_id, n.replaced_by_ad_id,
          chain.depth + 1 AS depth
        FROM ads n
        JOIN locations l2 ON l2.id = n.location_id
        JOIN chain ON chain.replaced_by_ad_id = n.id
        WHERE chain.depth < 50
      )
      SELECT *
      FROM chain
      ORDER BY depth ASC
      `,
      [rootId]
    );

    const ids = chainRes.rows.map((r) => r.id);

    // 4) photosCount + previewPhoto per id (single query)
    const enrich = await pool.query(
      `
      SELECT
        a.id,

        p.id         AS "previewPhotoId",
        p.file_path  AS "previewPhotoFilePath",
        p.sort_order AS "previewPhotoSortOrder",

        COALESCE(pc.photos_count, 0)::int AS "photosCount"
      FROM ads a

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

      WHERE a.id = ANY($1::uuid[])
      `,
      [ids]
    );

    const byId = new Map(enrich.rows.map((r) => [r.id, r]));

    // ✅ find latest published (last active in chain)
    const latestPublishedRow = [...chainRes.rows].reverse().find((r) => r.status === 'active') || null;
    const latestPublishedAdId = latestPublishedRow ? latestPublishedRow.id : null;

    let timeline = chainRes.rows.map((row) => {
      const extra = byId.get(row.id) || {};
      const previewPhoto = extra.previewPhotoId
        ? {
            id: extra.previewPhotoId,
            filePath: extra.previewPhotoFilePath,
            sortOrder: extra.previewPhotoSortOrder
          }
        : null;

      return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        publishedAt: row.published_at,
        stoppedAt: row.stopped_at,

        parentAdId: row.parent_ad_id,
        replacedByAdId: row.replaced_by_ad_id,

        location: {
          country: row.country,
          city: row.city,
          district: row.district
        },

        title: row.title,
        description: row.description,
        priceCents: row.price_cents,

        photosCount: extra.photosCount ?? 0,
        previewPhoto,

        isCurrent: row.id === adId,

        // ✅ UX marker
        isLatestPublished: latestPublishedAdId ? row.id === latestPublishedAdId : false
      };
    });

    // ✅ public: show only active versions (no draft/stopped leak)
    if (!isOwner) {
      timeline = timeline.filter((v) => v.status === 'active');
    }

    return res.json({
      data: {
        rootAdId: rootId,
        currentAdId: adId,
        isOwner: Boolean(isOwner),

        // ✅ UX addition
        latestPublishedAdId,

        timeline
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
    return res
      .status(400)
      .json({ error: 'BAD_REQUEST', message: 'sortOrder must be integer 0..50' });
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
      return res
        .status(409)
        .json({ error: 'NOT_ALLOWED', message: 'only own draft ads can be edited' });
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
    return res
      .status(400)
      .json({ error: 'BAD_REQUEST', message: 'items must be a non-empty array' });
  }

  for (const it of items) {
    const photoId = String(it?.photoId || '').trim();
    const sortOrder = Number(it?.sortOrder);

    if (!isUuid(photoId)) {
      return res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'each item.photoId must be UUID' });
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 50) {
      return res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'each item.sortOrder must be integer 0..50' });
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
      return res
        .status(409)
        .json({ error: 'NOT_ALLOWED', message: 'only own draft ads can be edited' });
    }

    const ids = items.map((x) => String(x.photoId).trim());
    const own = await client.query(
      `SELECT id FROM ad_photos WHERE ad_id = $1 AND id = ANY($2::uuid[])`,
      [adId, ids]
    );
    if (own.rowCount !== ids.length) {
      await client.query('ROLLBACK');
      return res
        .status(400)
        .json({ error: 'BAD_REQUEST', message: 'some photoIds do not belong to this ad' });
    }

    await client.query(`UPDATE ad_photos SET sort_order = sort_order + 100 WHERE ad_id = $1`, [
      adId
    ]);

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
    } catch {
      // ignore rollback error
    }

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
  getAdVersions,
  addPhotoToDraft,
  deletePhotoFromDraft,
  reorderPhotosInDraft
};
