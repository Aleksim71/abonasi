'use strict';

const jwt = require('jsonwebtoken');

/**
 * Optional JWT auth:
 * - valid token -> req.user = { id, email, name }
 * - missing/invalid token -> req.user = null
 */
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const id = payload.sub || payload.userId || payload.id;
    if (!id) {
      req.user = null;
      return next();
    }

    req.user = {
      id: String(id),
      email: payload.email,
      name: payload.name
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[optionalAuth] JWT error:', err.message);
    req.user = null;
  }

  return next();
}

module.exports = { optionalAuth };
