'use strict';

/**
 * ads.mappers.js
 * DB row -> API shape
 * Keep it boring and consistent.
 */

function mapAdRow(row) {
  if (!row) return null;

  // ⚠️ Подстрой под имена колонок/полей (snake_case vs camelCase)
  return {
    id: row.id,
    locationId: row.location_id ?? row.locationId,
    title: row.title,
    description: row.description,
    status: row.status,
    sourceAdId: row.source_ad_id ?? row.sourceAdId ?? null,
    createdBy: row.created_by ?? row.createdBy ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    updatedAt: row.updated_at ?? row.updatedAt ?? null
  };
}

function mapAdList(rows) {
  return (rows || []).map(mapAdRow);
}

module.exports = {
  mapAdRow,
  mapAdList
};
