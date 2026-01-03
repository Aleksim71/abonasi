'use strict';

require('dotenv').config();

const express = require('express');
const routes = require('./routes');
const docsRoutes = require('./routes/docs.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));

// Docs (OpenAPI + Swagger UI) — outside /api
app.use(docsRoutes);

// API
app.use('/api', routes);

app.use((req, res) => {
  return res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

module.exports = app;
