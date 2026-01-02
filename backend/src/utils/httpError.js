'use strict';

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
    this.status = status;
    this.body = body;
    // Не перечислимое, чтобы случайно не утекало при JSON.stringify(err)
    Object.defineProperty(this, 'status', { enumerable: false, value: status });
    Object.defineProperty(this, 'body', { enumerable: false, value: body });
    if (Error.captureStackTrace) Error.captureStackTrace(this, HttpError);
  }
}

/**
 * Бросаем стандартизированную ошибку.
 * @param {number} status
 * @param {string} code  - например: BAD_REQUEST / NOT_ALLOWED / CONFLICT / NOT_FOUND / UNAUTHORIZED
 * @param {string} message
 * @param {object} [extra] - опционально, если у вас в контракте есть дополнительные поля
 */
function txError(status, code, message, extra) {
  const body = Object.assign({ error: code, message }, extra || {});
  return new HttpError(status, body);
}

module.exports = { HttpError, txError };
