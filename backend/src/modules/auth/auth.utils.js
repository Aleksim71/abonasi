'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

// Prefer bcryptjs/bcrypt if installed; fallback to scrypt.
let bcrypt = null;
try {
  // eslint-disable-next-line global-require
  bcrypt = require('bcryptjs');
} catch (_) {
  try {
    // eslint-disable-next-line global-require
    bcrypt = require('bcrypt');
  } catch (_) {
    bcrypt = null;
  }
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function scryptHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, derivedKey) => {
      if (err) return reject(err);
      return resolve(derivedKey.toString('hex'));
    });
  });
}

/**
 * Hash password for storage.
 * Returns:
 * - bcrypt: "$2a$..."
 * - scrypt: "scrypt$<saltHex>$<hashHex>"
 */
async function hashPassword(password) {
  const pwd = String(password || '');
  if (!pwd) throw new Error('password is required');

  if (bcrypt) {
    const saltRounds = 10;
    return bcrypt.hash(pwd, saltRounds);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hashHex = await scryptHash(pwd, salt);
  return `scrypt$${salt}$${hashHex}`;
}

/**
 * Verify password against stored hash.
 */
async function verifyPassword(password, storedHash) {
  const pwd = String(password || '');
  const hash = String(storedHash || '');
  if (!pwd || !hash) return false;

  // scrypt format
  if (hash.startsWith('scrypt$')) {
    const parts = hash.split('$');
    if (parts.length !== 3) return false;
    const salt = parts[1];
    const expected = parts[2];
    const actual = await scryptHash(pwd, salt);
    return timingSafeEqualStr(actual, expected);
  }

  // bcrypt format
  if (bcrypt) {
    return bcrypt.compare(pwd, hash);
  }

  // If bcrypt isn't available but hash looks like bcrypt -> cannot verify.
  return false;
}

/**
 * Sign JWT for a user. Middleware expects:
 * - payload.sub (user id)
 * - payload.email
 * - payload.name
 */
function signToken(user, opts = {}) {
  const u = user || {};
  const id = u.sub ?? u.id ?? u.userId;
  const email = u.email;
  const name = u.name;

  if (!id) throw new Error('signToken: user id is required');

  const secret = getJwtSecret();
  const expiresIn = opts.expiresIn || process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    { email, name },
    secret,
    {
      subject: String(id), // -> payload.sub after verify()
      expiresIn
    }
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken
};
