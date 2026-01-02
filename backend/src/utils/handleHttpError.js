'use strict';

/**
 * Centralized HTTP error responder for controllers.
 *
 * Contract:
 * - TxError / HttpError throws: err.status + err.body
 * - Other errors: 500 DB_ERROR
 *
 * Usage:
 *   return handleHttpError(res, err, { scope: 'ads.create' });
 */
function handleHttpError(res, err, opts) {
  if (err && err.status && err.body) {
    return res.status(err.status).json(err.body);
  }

  const scope = opts && opts.scope ? String(opts.scope) : 'unknown';
  // eslint-disable-next-line no-console
  console.error(`[${scope}] DB_ERROR`, err);

  return res.status(500).json({ error: 'DB_ERROR', message: 'database error' });
}

module.exports = { handleHttpError };
