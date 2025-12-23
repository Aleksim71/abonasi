'use strict';

const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { optionalAuth } = require('../../middleware/optionalAuth');

const {
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
} = require('./ads.controller');

const router = express.Router();

router.get('/', listFeed);
router.get('/my', requireAuth, listMyAds);

// public card (optional auth to show isOwner)
router.get('/:id', optionalAuth, getAdById);

router.post('/', requireAuth, createDraft);

// PATCH: draft = update; published/stopped = fork (+ stop old if active)
router.patch('/:id', requireAuth, updateAd);

router.post('/:id/publish', requireAuth, publishAd);
router.post('/:id/stop', requireAuth, stopAd);
router.post('/:id/restart', requireAuth, restartAd);

// photos (MVP)
router.post('/:id/photos', requireAuth, addPhotoToDraft);
router.delete('/:id/photos/:photoId', requireAuth, deletePhotoFromDraft);
router.put('/:id/photos/reorder', requireAuth, reorderPhotosInDraft);

module.exports = router;
