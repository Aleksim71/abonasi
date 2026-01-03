'use strict';

const jwt = require('jsonwebtoken');
const { logger } = require('../utils/logger');

function requireAuth(req, res, next) {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // misconfig => 500, not "unauthorized"
      logger.error('auth.require', 'JWT_SECRET is missing');
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'server misconfigured' });
    }

    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Bearer token' });
    }

    const payload = jwt.verify(token, secret);

    // keep current contract (id/email/name)
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name
    };

    return next();
  } catch (err) {
    logger.warn('auth.require', 'JWT invalid', { message: err?.message });
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

module.exports = { requireAuth };
