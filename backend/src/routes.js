'use strict';

const express = require('express');
const { dbHealthcheck } = require('./config/db');

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

module.exports = router;
