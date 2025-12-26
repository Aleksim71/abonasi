'use strict';

const jwt = require('jsonwebtoken');

/**
 * Optional JWT auth:
 * - valid token -> req.user = { id }
 * - missing/invalid token -> req.user = null
 */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.sub || payload.userId || payload.id;
    req.user = userId ? { id: userId } : null;
  } catch (err) {
    console.warn('Error:', err.message);
    req.user = null;
  }

  return next();
}

module.exports = { optionalAuth };
