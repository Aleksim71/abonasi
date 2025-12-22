'use strict';

const express = require('express');
const { dbHealthcheck } = require('./config/db');

const locationsRoutes = require('./modules/locations/locations.routes');

const router = express.Router();

/**
 * Healthcheck
 * - checks server uptime
 * - checks DB connectivity
 */
router.get('/health', async (req, res) => {
  const uptimeSec = Math.round(process.uptime());
  const db = await dbHealthcheck();

  res.json({
    status: 'ok',
    uptimeSec,
    db
  });
});

/**
 * Locations
 */
router.use('/locations', locationsRoutes);

module.exports = router;
