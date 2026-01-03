'use strict';

/**
 * Minimal logger wrapper.
 * Central place to later swap console -> pino/winston/etc without touching codebase.
 *
 * Usage:
 *   logger.info('[scope]', 'message', { any: 'meta' });
 */

function fmt(scope, msg) {
  const s = scope ? String(scope) : 'app';
  return `[${s}] ${msg}`;
}

function safeMeta(meta) {
  if (meta === undefined) return undefined;
  try {
    // avoid circular JSON crashes
    JSON.stringify(meta);
    return meta;
  } catch (_e) {
    return { meta: '[unserializable]' };
  }
}

const logger = {
  info(scope, msg, meta) {
    // eslint-disable-next-line no-console
    console.log(fmt(scope, msg), safeMeta(meta) ?? '');
  },
  warn(scope, msg, meta) {
    // eslint-disable-next-line no-console
    console.warn(fmt(scope, msg), safeMeta(meta) ?? '');
  },
  error(scope, msg, meta) {
    // eslint-disable-next-line no-console
    console.error(fmt(scope, msg), safeMeta(meta) ?? '');
  }
};

module.exports = { logger };
