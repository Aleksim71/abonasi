'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');

const SALT_ROUNDS = 12;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Missing env var: JWT_SECRET');

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    { email: user.email, name: user.name },
    secret,
    { subject: user.id, expiresIn }
  );
}

/**
 * POST /api/auth/register
 * body: { email, password, name }
 */
async function register(req, res) {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const name = String(req.body.name || '').trim();

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'email, password, name are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'password must be at least 8 chars' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const r = await pool.query(
      `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, created_at
      `,
      [email, passwordHash, name]
    );

    const user = r.rows[0];
    const token = signToken(user);

    return res.status(201).json({ user, token });
  } catch (err) {
    // unique violation on users.email
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'CONFLICT', message: 'email already registered' });
    }
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * POST /api/auth/login
 * body: { email, password }
 */
async function login(req, res) {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'email and password are required' });
  }

  try {
    const r = await pool.query(
      `SELECT id, email, name, password_hash FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (r.rowCount === 0) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'invalid credentials' });
    }

    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'invalid credentials' });
    }

    const token = signToken(user);

    return res.json({
      user: { id: user.id, email: user.email, name: user.name },
      token
    });
  } catch (err) {
    return res.status(500).json({ error: 'DB_ERROR', message: String(err.message || err) });
  }
}

/**
 * GET /api/auth/me
 * requires Bearer token
 */
async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  register,
  login,
  me
};
