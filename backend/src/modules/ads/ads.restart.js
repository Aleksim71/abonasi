'use strict';

/**
 * POST /api/ads/:id/restart
 * requires auth
 */

const { restartAdTx } = require('./ads.restart.lifecycle');
const { handleHttpError } = require('../../utils/handleHttpError');

function isUuid(v) {
  return (
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

async function restartAd(req, res) {
  const userId = req.user?.id;
  const adId = String(req.params.id || '').trim();

  if (!isUuid(adId)) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'ad id must be a UUID'
    });
  }

  try {
    const row = await restartAdTx({ userId, adId });
    return res.status(200).json({ data: row });
  } catch (err) {
    return handleHttpError(res, err);
  }
}

module.exports = {
  restartAd
};
