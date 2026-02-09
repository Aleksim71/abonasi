'use strict';

const path = require('path');
const { pool } = require('../../config/db');
const { handleHttpError } = require('../../utils/handleHttpError');

function isUuid(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * Multipart upload handler for:
 * POST /api/ads/:id/photos  (field: photos[])
 *
 * Saves file_path in DB and returns photos with url:
 * url: /api/uploads/<file_path>
 */
async function uploadPhotosToDraft(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'ad id must be a UUID' });
  }

  const files = Array.isArray(req.files) ? req.files : [];
  if (!files.length) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'no files uploaded (field: photos)' });
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

    // Determine next sort_order start
    const maxRes = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) AS max FROM ad_photos WHERE ad_id = $1`,
      [adId]
    );
    let nextOrder = Number(maxRes.rows?.[0]?.max ?? -1);
    if (!Number.isFinite(nextOrder)) nextOrder = -1;
    nextOrder += 1;

    // Insert each file as a photo
    for (const f of files) {
      // multer diskStorage provides: f.filename and f.path
      const rel = path.posix.join('ads', adId, String(f.filename || ''));
      if (!rel || rel.length < 3 || rel.length > 500) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'filePath must be 3..500 chars' });
      }

      await pool.query(
        `INSERT INTO ad_photos (ad_id, file_path, sort_order) VALUES ($1, $2, $3)`,
        [adId, rel, nextOrder]
      );
      nextOrder += 1;
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

    const photos = photosRes.rows.map((p) => ({
      ...p,
      url: `/api/uploads/${String(p.filePath).replace(/^\/+/, '')}`
    }));

    return res.status(201).json({
      data: {
        adId,
        photos
      }
    });
  } catch (err) {
    return handleHttpError(res, err, { scope: 'ads.uploadPhotosToDraft' });
  }
}

module.exports = { uploadPhotosToDraft };
