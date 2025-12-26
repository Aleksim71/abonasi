'use strict';

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');

    if (type !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing Bearer token' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    return next();
  } catch (err) {
    console.warn('JWT error:', err.message);
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

module.exports = { requireAuth };
