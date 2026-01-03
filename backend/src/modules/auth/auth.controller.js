'use strict';

const { pool } = require('../../config/db');

const { handleHttpError } = require('../../utils/handleHttpError');
const { HttpError } = require('../../utils/httpError');
const { ERROR_CODES } = require('../../utils/errorCodes');

const { hashPassword, verifyPassword, signToken } = require('./auth.utils');

function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function safeUser(row) {
  if (!row) return null;
  const { password_hash, passwordHash, ...safe } = row;
  return safe;
}

/**
 * POST /api/auth/register
 * body: { email, password, name }
 *
 * Success: { data: { user, token } }
 */
async function register(req, res) {
  const scope = 'auth.register';

  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const name = String(req.body?.name || '').trim();

    if (!isNonEmptyString(email) || !email.includes('@')) {
      throw new HttpError(400, ERROR_CODES.BAD_REQUEST, 'email is required');
    }
    if (!isNonEmptyString(password) || password.length < 6) {
      throw new HttpError(400, ERROR_CODES.BAD_REQUEST, 'password must be at least 6 chars');
    }
    if (!isNonEmptyString(name)) {
      throw new HttpError(400, ERROR_CODES.BAD_REQUEST, 'name is required');
    }

    const passwordHash = await hashPassword(password);

    const client = await pool.connect();
    try {
      const insert = await client.query(
        `
        INSERT INTO users (email, password_hash, name)
        VALUES ($1, $2, $3)
        RETURNING id, email, name, created_at
        `,
        [email, passwordHash, name]
      );

      const user = insert.rows[0];
      const token = signToken({ id: user.id, email: user.email, name: user.name });

      return res.status(201).json({
        data: {
          user: safeUser(user),
          token
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return handleHttpError(res, err, { scope });
  }
}

/**
 * POST /api/auth/login
 * body: { email, password }
 *
 * Success: { data: { user, token } }
 */
async function login(req, res) {
  const scope = 'auth.login';

  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!isNonEmptyString(email) || !email.includes('@')) {
      throw new HttpError(400, ERROR_CODES.BAD_REQUEST, 'email is required');
    }
    if (!isNonEmptyString(password)) {
      throw new HttpError(400, ERROR_CODES.BAD_REQUEST, 'password is required');
    }

    const client = await pool.connect();
    try {
      const q = await client.query(
        `
        SELECT id, email, name, password_hash, created_at
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [email]
      );

      const user = q.rows[0];
      if (!user) {
        throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'invalid credentials');
      }

      const ok = await verifyPassword(password, user.password_hash);
      if (!ok) {
        throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'invalid credentials');
      }

      const token = signToken({ id: user.id, email: user.email, name: user.name });

      return res.status(200).json({
        data: {
          user: safeUser(user),
          token
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return handleHttpError(res, err, { scope });
  }
}

/**
 * GET /api/auth/me
 * requires auth middleware (req.user)
 *
 * Success: { data: { user } }
 */
async function me(req, res) {
  const scope = 'auth.me';

  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'unauthorized');
    }

    const q = await pool.query(
      `
      SELECT id, email, name, created_at
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const user = q.rows[0];
    if (!user) {
      throw new HttpError(401, ERROR_CODES.UNAUTHORIZED, 'unauthorized');
    }

    return res.status(200).json({
      data: {
        user: safeUser(user)
      }
    });
  } catch (err) {
    return handleHttpError(res, err, { scope });
  }
}

module.exports = {
  register,
  login,
  me
};
