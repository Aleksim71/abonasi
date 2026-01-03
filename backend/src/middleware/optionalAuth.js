'use strict';

const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

/**
 * Optional JWT auth:
 * - valid token -> req.user = { id, email?, name? }
 * - missing/invalid token -> req.user = null
 */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.slice('Bearer '.length).trim();
  const secret = process.env.JWT_SECRET;

  // If secret is missing — treat token as unusable but don't break public endpoints.
  if (!secret) {
    logger.error('auth.optional', 'JWT_SECRET is missing');
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, secret);

    // support multiple shapes (sub/userId/id) but normalize
    const userId = payload.sub || payload.userId || payload.id;
    if (!userId) {
      req.user = null;
      return next();
    }

    req.user = {
      id: userId,
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.name ? { name: payload.name } : {})
    };
  } catch (err) {
    logger.warn('auth.optional', 'JWT invalid', { message: err?.message });
    req.user = null;
  }

  return next();
}

module.exports = { optionalAuth };
