'use strict';

const express = require('express');
const {
  listLocations,
  listCountries,
  listCities,
  listDistricts,
  resolveLocation
} = require('./locations.controller');

const router = express.Router();

router.get('/countries', listCountries);
router.get('/cities', listCities);
router.get('/districts', listDistricts);
router.get('/resolve', resolveLocation);

router.get('/', listLocations);

module.exports = router;
