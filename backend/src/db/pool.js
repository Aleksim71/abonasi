'use strict';

// Compatibility alias.
// Always re-export the real pool from config/db
module.exports = require('../config/db').pool;
