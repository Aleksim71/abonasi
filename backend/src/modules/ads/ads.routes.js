'use strict';

const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const {
  createDraft,
  updateDraft,
  publishAd,
  stopAd,
  listMyAds,
  listFeed
} = require('./ads.controller');

const router = express.Router();

router.get('/', listFeed);
router.get('/my', requireAuth, listMyAds);

router.post('/', requireAuth, createDraft);
router.patch('/:id', requireAuth, updateDraft);

router.post('/:id/publish', requireAuth, publishAd);
router.post('/:id/stop', requireAuth, stopAd);

module.exports = router;
