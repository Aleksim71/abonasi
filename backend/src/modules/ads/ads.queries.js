'use strict';

/**
 * ads.queries.js
 * Pure DB layer: only SQL + client.query(...)
 * All functions accept (client, ...args) and return rows/rowCount.
 */

async function getAdById(client, adId) {
  const { rows } = await client.query(
    `
    SELECT *
    FROM ads
    WHERE id = $1
    `,
    [adId]
  );
  return rows[0] || null;
}

async function lockAdById(client, adId) {
  const { rows } = await client.query(
    `
    SELECT *
    FROM ads
    WHERE id = $1
    FOR UPDATE
    `,
    [adId]
  );
  return rows[0] || null;
}

async function insertDraftAd(client, payload) {
  // ⚠️ Подстрой под твою схему (колонки, дефолты)
  const { rows } = await client.query(
    `
    INSERT INTO ads (location_id, title, description, status)
    VALUES ($1, $2, $3, 'draft')
    RETURNING *
    `,
    [payload.locationId, payload.title, payload.description]
  );
  return rows[0];
}

async function updateDraftAd(client, adId, patch) {
  // ⚠️ Подстрой под твою схему и whitelist полей
  // Рекомендация: whitelist делай на уровне lifecycle/controller, тут — только SQL.
  const { rows } = await client.query(
    `
    UPDATE ads
    SET
      title = COALESCE($2, title),
      description = COALESCE($3, description),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [adId, patch.title ?? null, patch.description ?? null]
  );
  return rows[0] || null;
}

async function setAdStatus(client, adId, status) {
  const { rows } = await client.query(
    `
    UPDATE ads
    SET status = $2,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [adId, status]
  );
  return rows[0] || null;
}

async function insertAdVersionSnapshot(client, adRow, meta) {
  // ⚠️ Если у тебя есть таблица versions/timeline — перенеси свой текущий SQL сюда.
  // meta: { action, actorUserId, note, ... }
  await client.query(
    `
    INSERT INTO ad_versions (ad_id, status, snapshot, action, actor_user_id, created_at)
    VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
    `,
    [
      adRow.id,
      adRow.status,
      JSON.stringify(adRow),
      meta.action || null,
      meta.actorUserId || null
    ]
  );
}

async function forkAdFromSource(client, sourceAdRow, actorUserId) {
  // ⚠️ Подстрой под свою “fork” модель.
  // Идея: создаём новую запись, копируя поля, ставим статус 'active' или 'draft' — как у тебя.
  const { rows } = await client.query(
    `
    INSERT INTO ads (location_id, title, description, status, source_ad_id, created_by)
    VALUES ($1, $2, $3, 'active', $4, $5)
    RETURNING *
    `,
    [
      sourceAdRow.location_id,
      sourceAdRow.title,
      sourceAdRow.description,
      sourceAdRow.id,
      actorUserId
    ]
  );
  return rows[0];
}

module.exports = {
  getAdById,
  lockAdById,
  insertDraftAd,
  updateDraftAd,
  setAdStatus,
  insertAdVersionSnapshot,
  forkAdFromSource
};
