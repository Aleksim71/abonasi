'use strict';

const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../middleware/auth');
const { optionalAuth } = require('../../middleware/optionalAuth');

const ads = require('./ads.controller');

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
 */
router.post('/:id/photos', requireAuth, ads.addPhotoToDraft);
router.delete('/:id/photos/:photoId', requireAuth, ads.deletePhotoFromDraft);
router.patch('/:id/photos/reorder', requireAuth, ads.reorderPhotosInDraft);

module.exports = router;
