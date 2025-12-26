'use strict';

const express = require('express');
const { dbHealthcheck } = require('./config/db');

const locationsRoutes = require('./modules/locations/locations.routes');
const authRoutes = require('./modules/auth/auth.routes');
const adsRoutes = require('./modules/ads/ads.routes');

const router = express.Router();

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

router.use('/locations', locationsRoutes);
router.use('/auth', authRoutes);
router.use('/ads', adsRoutes);

module.exports = router;
