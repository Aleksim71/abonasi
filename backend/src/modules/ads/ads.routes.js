'use strict';

const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const { optionalAuth } = require('../../middleware/optionalAuth');

const {
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
} = require('./ads.controller');

const router = express.Router();

router.get('/', listFeed);
router.get('/my', requireAuth, listMyAds);

// public card (optional auth to show isOwner)
router.get('/:id', optionalAuth, getAdById);

router.post('/', requireAuth, createDraft);
router.patch('/:id', requireAuth, updateDraft);

router.post('/:id/publish', requireAuth, publishAd);
router.post('/:id/stop', requireAuth, stopAd);

// photos (MVP)
router.post('/:id/photos', requireAuth, addPhotoToDraft);

router.delete('/:id/photos/:photoId', requireAuth, deletePhotoFromDraft);
router.put('/:id/photos/reorder', requireAuth, reorderPhotosInDraft);


module.exports = router;
