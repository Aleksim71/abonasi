'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const router = express.Router();

// Repo root is ~/abonasi, backend is ~/abonasi/backend
// OpenAPI spec lives at ~/abonasi/docs/openapi.yaml
const OPENAPI_YAML_PATH = path.join(__dirname, '../../../docs/openapi.yaml');

function readYaml() {
  return fs.readFileSync(OPENAPI_YAML_PATH, 'utf8');
}

function loadSpec() {
  const raw = readYaml();
  return yaml.load(raw);
}

/**
 * GET /api/openapi.yaml
 * Serves the raw OpenAPI YAML (single source of truth for clients).
 */
router.get('/openapi.yaml', (_req, res, next) => {
  try {
    res.type('text/yaml').send(readYaml());
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/docs
 * Swagger UI.
 *
 * Note: This router is mounted under /api (see src/app.js),
 * so these routes become:
 *  - /api/docs
 *  - /api/openapi.yaml
 */
router.use('/docs', swaggerUi.serve);
router.get('/docs', (req, res, next) => {
  try {
    const spec = loadSpec();
    return swaggerUi.setup(spec, {
      explorer: true,
      customSiteTitle: 'Abonasi API Docs'
    })(req, res);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
