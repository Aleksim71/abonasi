'use strict';

/**
 * ads.lifecycle.js
 * Business flows + transactions + trigger bypass (SET LOCAL).
 *
 * IMPORTANT:
 * - No req/res here.
 * - Throw typed errors with "code" to let controller map them to HTTP.
 */

const pool = require('../../db/pool'); // ⚠️ поправь путь под твой проект
const Q = require('./ads.queries');
const { mapAdRow } = require('./ads.mappers');
const { ERROR_CODES } = require('../../utils/errorCodes');

function err(code, message, extra) {
  const e = new Error(message || code);
  e.code = code;
  if (extra) e.extra = extra;
  return e;
}

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Bypass strict trigger inside current tx.
 * Use SET LOCAL or set_config(..., true) — depending on your existing trigger logic.
 */
async function allowNonDraftUpdates(client) {
  // твой текущий паттерн:
  await client.query(`SELECT set_config('app.allow_non_draft_update','1', true)`);
}

async function createDraft({ userId, payload }) {
  return withTx(async (client) => {
    const row = await Q.insertDraftAd(client, payload);
    await Q.insertAdVersionSnapshot(client, row, { action: 'draft_create', actorUserId: userId });
    return mapAdRow(row);
  });
}

async function updateDraft({ userId, adId, patch }) {
  return withTx(async (client) => {
    const cur = await Q.lockAdById(client, adId);
    if (!cur) throw err(ERROR_CODES.NOT_FOUND, 'ad not found');

    if (cur.status !== 'draft') {
      // draft-only rule enforced also by trigger, но тут даём понятную ошибку
      throw err(ERROR_CODES.NOT_ALLOWED, 'only draft can be updated');
    }

    const row = await Q.updateDraftAd(client, adId, patch);
    await Q.insertAdVersionSnapshot(client, row, { action: 'draft_update', actorUserId: userId });
    return mapAdRow(row);
  });
}

async function publish({ userId, adId }) {
  return withTx(async (client) => {
    const cur = await Q.lockAdById(client, adId);
    if (!cur) throw err(ERROR_CODES.NOT_FOUND, 'ad not found');

    if (cur.status !== 'draft') {
      throw err(ERROR_CODES.NOT_ALLOWED, 'only draft can be published');
    }

    // статус меняется не-draft апдейтом → разрешаем в рамках tx
    await allowNonDraftUpdates(client);

    const row = await Q.setAdStatus(client, adId, 'active');
    await Q.insertAdVersionSnapshot(client, row, { action: 'publish', actorUserId: userId });
    return mapAdRow(row);
  });
}

async function stop({ userId, adId }) {
  return withTx(async (client) => {
    const cur = await Q.lockAdById(client, adId);
    if (!cur) throw err(ERROR_CODES.NOT_FOUND, 'ad not found');

    if (cur.status !== 'active') {
      throw err(ERROR_CODES.NOT_ALLOWED, 'only active can be stopped');
    }

    await allowNonDraftUpdates(client);

    const row = await Q.setAdStatus(client, adId, 'stopped');
    await Q.insertAdVersionSnapshot(client, row, { action: 'stop', actorUserId: userId });
    return mapAdRow(row);
  });
}

/**
 * restart rules:
 * - stopped -> active : OK
 * - active -> active : NOT_ALLOWED (or idempotent?) — keep your current behavior
 * - draft -> ? : NOT_ALLOWED
 * - if there is an "active fork exists" etc. -> CONFLICT
 *
 * You said you fixed NOT_ALLOWED vs CONFLICT — keep that logic here.
 */
async function restart({ userId, adId, checkConflict }) {
  return withTx(async (client) => {
    const cur = await Q.lockAdById(client, adId);
    if (!cur) throw err(ERROR_CODES.NOT_FOUND, 'ad not found');

    if (cur.status !== 'stopped') {
      // ✅ именно NOT_ALLOWED для неправильного статуса
      throw err(ERROR_CODES.NOT_ALLOWED, 'only stopped can be restarted');
    }

    // ✅ CONFLICT только если реально есть конфликт по доменной логике
    if (typeof checkConflict === 'function') {
      const conflict = await checkConflict({ client, adRow: cur });
      if (conflict) throw err(ERROR_CODES.CONFLICT, 'restart conflict', conflict);
    }

    await allowNonDraftUpdates(client);

    const row = await Q.setAdStatus(client, adId, 'active');
    await Q.insertAdVersionSnapshot(client, row, { action: 'restart', actorUserId: userId });
    return mapAdRow(row);
  });
}

async function fork({ userId, adId }) {
  return withTx(async (client) => {
    const source = await Q.lockAdById(client, adId);
    if (!source) throw err(ERROR_CODES.NOT_FOUND, 'ad not found');

    // ⚠️ Подстрой правила: обычно форкают active или stopped — как у тебя в тесте.
    if (source.status !== 'active' && source.status !== 'stopped') {
      throw err(ERROR_CODES.NOT_ALLOWED, 'only active/stopped can be forked');
    }

    // Важно: форк — это insert (триггер draft-only не мешает), но если ты делаешь апдейт source —
    // разрешай allowNonDraftUpdates(client).
    const forked = await Q.forkAdFromSource(client, source, userId);
    await Q.insertAdVersionSnapshot(client, forked, { action: 'fork', actorUserId: userId });

    return mapAdRow(forked);
  });
}

module.exports = {
  createDraft,
  updateDraft,
  publish,
  stop,
  restart,
  fork
};
