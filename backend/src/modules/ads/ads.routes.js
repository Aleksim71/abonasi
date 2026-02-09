'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { optionalAuth } = require('../../middleware/optionalAuth');

const ads = require('./ads.controller');
const { maybeUploadPhotos } = require('./ads.upload');
const { uploadPhotosToDraft } = require('./ads.photos.upload.controller');

/**
 * Lists
 */
router.get('/my', requireAuth, ads.listMyAds);
router.get('/feed', optionalAuth, ads.listFeed);

/**
 * Create
 */
router.post('/', requireAuth, ads.createDraft);

/**
 * Public card
 */
router.get('/:id', optionalAuth, ads.getAdById);

/**
 * Update / lifecycle
 */
router.patch('/:id', requireAuth, ads.updateAd);
router.post('/:id/publish', requireAuth, ads.publishAd);
router.post('/:id/stop', requireAuth, ads.stopAd);
router.post('/:id/restart', requireAuth, ads.restartAd);

/**
 * Versions
 */
router.get('/:id/versions', optionalAuth, ads.getAdVersions);

/**
 * Photos in draft
 * - multipart: field "photos" -> handled by uploadPhotosToDraft
 * - json: { filePath, sortOrder? } -> handled by old ads.addPhotoToDraft (kept for compatibility)
 */
router.post('/:id/photos', requireAuth, maybeUploadPhotos, (req, res, next) => {
  const hasFiles = Array.isArray(req.files) && req.files.length > 0;
  if (hasFiles) return uploadPhotosToDraft(req, res, next);
  return ads.addPhotoToDraft(req, res, next);
});

router.delete('/:id/photos/:photoId', requireAuth, ads.deletePhotoFromDraft);

/**
 * ✅ Persist photos order (DnD reorder)
 * PATCH /api/ads/:id/photos/reorder
 * Body: { photoIds: string[] }
 */
router.patch('/:id/photos/reorder', requireAuth, ads.reorderPhotosInDraft);

module.exports = router;
