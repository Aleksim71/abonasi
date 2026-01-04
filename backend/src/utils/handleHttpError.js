'use strict';

/**
 * Centralized HTTP error responder for controllers.
 *
 * Contract:
 *   error responses are ALWAYS { error: string, message: string }
 */
function handleHttpError(res, err, opts) {
  const normalizeBody = (body, fallbackStatus) => {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return {
        error: String(body.error || 'INTERNAL'),
        message: String(body.message || `Request failed with status ${fallbackStatus}`)
      };
    }
    if (typeof body === 'string' && body.trim()) {
      const s = body.trim();
      return { error: s, message: s };
    }
    return { error: 'INTERNAL', message: `Request failed with status ${fallbackStatus}` };
  };

  if (err && err.status) {
    const status = Number(err.status) || 500;
    return res.status(status).json(normalizeBody(err.body, status));
  }

  const scope = opts && opts.scope ? String(opts.scope) : 'unknown';
  // eslint-disable-next-line no-console
  console.error(`[${scope}]`, err);

  return res.status(500).json({ error: 'DB_ERROR', message: 'database error' });
}

module.exports = { handleHttpError };
