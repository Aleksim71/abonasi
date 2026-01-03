'use strict';

const express = require('express');
const { dbHealthcheck } = require('./config/db');

const router = express.Router();

// Health
router.get('/health', async (req, res) => {
  const uptimeSec = Math.round(process.uptime());

  try {
    const db = await dbHealthcheck();

    return res.status(db?.ok === false ? 503 : 200).json({
      status: db?.ok === false ? 'degraded' : 'ok',
      uptimeSec,
      db
    });
  } catch (e) {
    // важно: НЕ даём упасть процессу
    return res.status(503).json({
      status: 'degraded',
      uptimeSec,
      db: { ok: false, error: String(e?.message || e) }
    });
  }
});

// Modules
router.use('/auth', require('./modules/auth/auth.routes'));
router.use('/locations', require('./modules/locations/locations.routes'));
router.use('/ads', require('./modules/ads/ads.routes'));

module.exports = router;
