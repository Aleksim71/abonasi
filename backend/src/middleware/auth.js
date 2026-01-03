'use strict';

const jwt = require('jsonwebtoken');

/**
 * Required JWT auth:
 * - missing/invalid token -> 401
 * - valid token -> req.user = { id, email, name }
 */
function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Bearer token' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Canonical user mapping (keep stable shape)
    const id = payload.sub || payload.userId || payload.id;
    if (!id) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
    }

    req.user = {
      id: String(id),
      email: payload.email,
      name: payload.name
    };

    return next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[requireAuth] JWT error:', err.message);
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

module.exports = { requireAuth };
