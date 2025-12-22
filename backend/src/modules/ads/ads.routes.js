'use strict';

const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const {
  createDraft,
  publishAd,
  stopAd,
  listMyAds,
  listFeed
} = require('./ads.controller');

const router = express.Router();

// Public feed (MVP: requires locationId)
router.get('/', listFeed);

// My ads
router.get('/my', requireAuth, listMyAds);

// Create draft
router.post('/', requireAuth, createDraft);

// State transitions
router.post('/:id/publish', requireAuth, publishAd);
router.post('/:id/stop', requireAuth, stopAd);

module.exports = router;
