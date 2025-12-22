'use strict';

require('dotenv').config();

const express = require('express');
const routes = require('./routes');

const app = express();

app.use(express.json({ limit: '1mb' }));

app.use('/api', routes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

module.exports = app;
