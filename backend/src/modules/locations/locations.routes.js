'use strict';

const express = require('express');
const {
  listLocations,
  listCountries,
  listCities,
  listDistricts
} = require('./locations.controller');

const router = express.Router();

router.get('/countries', listCountries);
router.get('/cities', listCities);
router.get('/districts', listDistricts);

// Keep the existing list endpoint:
router.get('/', listLocations);

module.exports = router;
