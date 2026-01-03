'use strict';

const jwt = require('jsonwebtoken');

/**
 * Extract Bearer token from Authorization header.
 * Returns token string or null.
 */
function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [type, ...rest] = header.split(' ');

  if (type !== 'Bearer') return null;

  const token = rest.join(' ').trim();
  if (!token) return null;

  return token;
}

/**
 * Resolve user id from JWT payload.
 * Supports common shapes: { sub }, { userId }, { id }.
 */
function getUserId(payload) {
  return payload?.sub || payload?.userId || payload?.id || null;
}

/**
 * Optional JWT auth:
 * - valid token -> req.user = { id, email?, name? }
 * - missing/invalid token -> req.user = null
 */
function optionalAuth(req, _res, next) {
  const token = getBearerToken(req);

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const id = getUserId(payload);
    if (!id) {
      req.user = null;
      return next();
    }

    // Keep contract flexible: minimum { id }
    req.user = { id: String(id) };

    // Optional fields (if present in token)
    if (payload.email) req.user.email = payload.email;
    if (payload.name) req.user.name = payload.name;

    return next();
  } catch (_err) {
    // Silent fail for optional auth
    req.user = null;
    return next();
  }
}

module.exports = { optionalAuth };
