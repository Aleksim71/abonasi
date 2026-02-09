'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const routes = require('./routes');

const app = express();

app.use(express.json({ limit: '1mb' }));

// Serve uploaded files behind /api (so Vite proxy can forward it)
const UPLOADS_DIR = path.join(__dirname, '../public/uploads');
app.use('/api/uploads', express.static(UPLOADS_DIR));

/**
 * OpenAPI YAML served from repo-root /docs/openapi.yaml
 * backend/src -> ../../docs/openapi.yaml
 */
const OPENAPI_PATH = path.join(__dirname, '../../docs/openapi.yaml');

app.get('/openapi.yaml', (req, res) => {
  try {
    const yaml = fs.readFileSync(OPENAPI_PATH, 'utf8');
    res.setHeader('Content-Type', 'application/yaml; charset=utf-8');
    return res.status(200).send(yaml);
  } catch (e) {
    return res.status(500).json({
      error: 'INTERNAL',
      message: `Cannot read openapi.yaml: ${String(e?.message || e)}`
    });
  }
});

/**
 * Swagger UI (CDN) on /docs, points to /openapi.yaml
 */
app.get('/docs', (req, res) => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Abonasi API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
  <style>
    body { margin: 0; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/openapi.yaml",
      dom_id: "#swagger-ui",
      deepLinking: true,
      persistAuthorization: true
    });
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
});

app.use('/api', routes);

/**
 * 404 contract
 */
app.use((req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

module.exports = app;
