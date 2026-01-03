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
 * Required JWT auth:
 * - missing/invalid token -> 401
 * - valid token -> req.user = { id, email, name }
 */
function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Bearer token' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const id = getUserId(payload);
    if (!id) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }

    req.user = {
      id: String(id),
      email: payload.email,
      name: payload.name
    };

    return next();
  } catch (_err) {
    // Do not leak JWT error details
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

module.exports = { requireAuth };
