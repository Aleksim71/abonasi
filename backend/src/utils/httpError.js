'use strict';

const { ERROR_CODES } = require('./errorCodes');

/**
 * TxError / HttpError — единый контракт ошибок для tx/lifecycle.
 * Контроллер должен проверять err.status + err.body и отвечать ими.
 */
class HttpError extends Error {
  /**
   * @param {number} status
   * @param {object} body
   */
  constructor(status, body) {
    super(body?.message || `HTTP_ERROR_${status}`);
    this.name = 'HttpError';
    // Не перечислимые поля, чтобы не утекали при JSON.stringify(err)
    Object.defineProperty(this, 'status', { enumerable: false, value: status });
    Object.defineProperty(this, 'body', { enumerable: false, value: body });
    if (Error.captureStackTrace) Error.captureStackTrace(this, HttpError);
  }
}

/**
 * Бросаем стандартизированную ошибку.
 * @param {number} status
 * @param {string} code  - из ERROR_CODES
 * @param {string} message
 * @param {object} [extra] - опционально, если в контракте есть дополнительные поля
 */
function txError(status, code, message, extra) {
  const safeCode = ERROR_CODES[code] || code;
  const body = Object.assign({ error: safeCode, message }, extra || {});
  throw new HttpError(status, body);
}

module.exports = { HttpError, txError };
