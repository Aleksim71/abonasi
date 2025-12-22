'use strict';

const express = require('express');
const { dbHealthcheck } = require('./config/db');

const locationsRoutes = require('./modules/locations/locations.routes');
const authRoutes = require('./modules/auth/auth.routes');
const adsRoutes = require('./modules/ads/ads.routes');

const router = express.Router();

router.get('/health', async (req, res) => {
  const uptimeSec = Math.round(process.uptime());
  const db = await dbHealthcheck();

  res.json({
    status: 'ok',
    uptimeSec,
    db
  });
});

router.use('/locations', locationsRoutes);
router.use('/auth', authRoutes);
router.use('/ads', adsRoutes);

module.exports = router;
