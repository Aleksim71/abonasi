'use strict';

const express = require('express');
const { listLocations } = require('./locations.controller');

const router = express.Router();

router.get('/', listLocations);

module.exports = router;
