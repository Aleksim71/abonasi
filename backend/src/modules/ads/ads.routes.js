'use strict';

const express = require('express');

function pickMiddleware(mod, names) {
  // direct function export
  if (typeof mod === 'function') return mod;

  // common patterns: { auth }, { requireAuth }, { optionalAuth }, { default }
  if (mod && typeof mod === 'object') {
    for (const n of names) {
      if (typeof mod[n] === 'function') return mod[n];
    }
    if (typeof mod.default === 'function') return mod.default;
  }

  // nothing worked
  return null;
}

// ✅ correct relative paths from: src/modules/ads -> src/middleware
const authMod = require('../../middleware/auth');
const optMod = require('../../middleware/optionalAuth');

const requireAuth = pickMiddleware(authMod, ['requireAuth', 'auth', 'middleware']);
const optionalAuth = pickMiddleware(optMod, ['optionalAuth', 'auth', 'middleware']);

if (!requireAuth) {
  throw new Error(
    'Auth middleware export is not a function. Expected module.exports = fn OR { auth } OR { requireAuth }.'
  );
}
if (!optionalAuth) {
  throw new Error(
    'OptionalAuth middleware export is not a function. Expected module.exports = fn OR { optionalAuth }.'
  );
}

const ads = require('./ads.controller');

const router = express.Router();

/**
 * IMPORTANT:
 * Specific routes MUST go before "/:id"
 */

// feed
router.get('/', ads.listFeed);

// my ads
router.get('/my', requireAuth, ads.listMyAds);

// ✅ versions chain (optional auth: owner sees any status; public only active)
router.get('/:id/versions', optionalAuth, ads.getAdVersions);

// public card (optional auth: owner can view any status)
router.get('/:id', optionalAuth, ads.getAdById);

// create / edit
router.post('/', requireAuth, ads.createDraft);
router.patch('/:id', requireAuth, ads.updateAd);

// status actions
router.post('/:id/publish', requireAuth, ads.publishAd);
router.post('/:id/stop', requireAuth, ads.stopAd);
router.post('/:id/restart', requireAuth, ads.restartAd);

// photos (draft only)
router.post('/:id/photos', requireAuth, ads.addPhotoToDraft);
router.delete('/:id/photos/:photoId', requireAuth, ads.deletePhotoFromDraft);
router.put('/:id/photos/reorder', requireAuth, ads.reorderPhotosInDraft);

module.exports = router;
