'use strict';

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

/**
 * Recursively search for the first occurrence of a key in an object/array.
 * Returns undefined if not found.
 */
function deepFindByKeys(root, keys) {
  const seen = new Set();

  function walk(node) {
    if (!node || typeof node !== 'object') return undefined;
    if (seen.has(node)) return undefined;
    seen.add(node);

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found !== undefined) return found;
      }
      return undefined;
    }

    // plain object
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(node, k)) return node[k];
    }

    for (const v of Object.values(node)) {
      const found = walk(v);
      if (found !== undefined) return found;
    }

    return undefined;
  }

  return walk(root);
}

/**
 * Source-of-truth read:
 * - call GET /api/ads/:id
 * - extract price field from anywhere in response (priceCents or price_cents)
 */
async function fetchPriceFromApi(app, token, adId) {
  const res = await withAuth(request(app).get(`/api/ads/${adId}`), token).expect(200);
  const body = res.body ?? {};
  const price = deepFindByKeys(body, ['priceCents', 'price_cents']);
  return { res, body, price };
}

describe('Ads fork workflow (integration)', () => {
  let token;
  let locationId;

  beforeAll(async () => {
    // Keep locations seed, reset other tables
    await resetDb();
    locationId = await ensureTestLocation();

    const stamp = Date.now();
    token = await registerAndLogin(app, {
      email: `jest_${stamp}@example.com`,
      password: 'password123',
      name: 'Jest User'
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  test('draft -> publish -> fork active -> stop -> fork stopped -> versions timeline', async () => {
    // A) create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    )
      .send({
        locationId,
        title: 'Smoke A',
        description: 'Smoke A description 1234567890',
        priceCents: 1000
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // B) add photo to draft
    const addPhotoRes = await withAuth(
      request(app).post(`/api/ads/${draftId}/photos`).set('Content-Type', 'application/json'),
      token
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    expect(addPhotoRes.body?.data?.photos?.length).toBe(1);

    // C) publish draft -> active
    await withAuth(request(app).post(`/api/ads/${draftId}/publish`), token).expect(200);

    // D) PATCH active -> fork (new active + old stopped)
    //    ✅ also check priceCents normalization (string -> int)
    const forkActiveRes = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      token
    )
      .send({
        title: 'Smoke A (EDIT)',
        description: 'Smoke A edited description 1234567890',
        priceCents: '1200' // <-- IMPORTANT: string must be normalized to integer
      })
      .expect(200);

    expect(forkActiveRes.body?.notice?.mode).toBe('forked');
    const newActiveId = forkActiveRes.body?.data?.newAdId;
    expect(newActiveId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkActiveRes.body?.data?.newStatus).toBe('active');

    // ✅ verify normalized value via GET (DTO-agnostic)
    const { price: activePrice, body: activeGetBody } = await fetchPriceFromApi(app, token, newActiveId);
    if (activePrice === undefined) {
      // helpful debug without breaking other assertions context
      // eslint-disable-next-line no-console
      console.log('DEBUG: GET /api/ads/:id response does not contain priceCents/price_cents:', activeGetBody);
    }
    expect(activePrice).toBe(1200);

    // E) stop new active
    const stoppedRes = await withAuth(request(app).post(`/api/ads/${newActiveId}/stop`), token).expect(200);
    expect(stoppedRes.body?.status).toBe('stopped');

    // F) PATCH stopped -> fork (must create NEW DRAFT)
    //    ✅ also check priceCents normalization (empty string -> null)
    const forkStoppedRes = await withAuth(
      request(app).patch(`/api/ads/${newActiveId}`).set('Content-Type', 'application/json'),
      token
    )
      .send({
        title: 'Stopped -> edit',
        description: 'Stopped -> edit description 1234567890',
        priceCents: '' // <-- IMPORTANT: should become null (not NaN / not "")
      })
      .expect(200);

    const newDraftId = forkStoppedRes.body?.data?.newAdId;
    expect(newDraftId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkStoppedRes.body?.data?.newStatus).toBe('draft');

    // ✅ verify normalized null via GET (DTO-agnostic)
    const { price: draftPrice, body: draftGetBody } = await fetchPriceFromApi(app, token, newDraftId);
    if (draftPrice === undefined) {
      // eslint-disable-next-line no-console
      console.log('DEBUG: GET /api/ads/:id response does not contain priceCents/price_cents:', draftGetBody);
    }
    expect(draftPrice).toBe(null);

    // G) versions timeline from latest draft
    const versionsRes = await withAuth(request(app).get(`/api/ads/${newDraftId}/versions`), token).expect(200);

    const data = versionsRes.body?.data;
    expect(data?.isOwner).toBe(true);
    expect(data?.currentAdId).toBe(newDraftId);
    expect(Array.isArray(data?.timeline)).toBe(true);
    expect(data.timeline.length).toBeGreaterThanOrEqual(3);

    // last item should be current
    const cur = data.timeline.find((x) => x.isCurrent);
    expect(cur?.id).toBe(newDraftId);

    // each version should have photosCount >= 1
    for (const v of data.timeline) {
      expect(Number(v.photosCount)).toBeGreaterThanOrEqual(1);
      expect(v.previewPhoto?.filePath).toBe('uploads/smoke.jpg');
    }
  });

  test('updateAd edge-cases: priceCents=0 stays 0, priceCents=null stays null', async () => {
    // A) create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    )
      .send({
        locationId,
        title: 'Edge price cents',
        description: 'Edge cases for priceCents 1234567890',
        priceCents: 1000
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // B) add photo to draft
    const addPhotoRes = await withAuth(
      request(app).post(`/api/ads/${draftId}/photos`).set('Content-Type', 'application/json'),
      token
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    expect(addPhotoRes.body?.data?.photos?.length).toBe(1);

    // C) PATCH draft: priceCents = 0 must remain 0 (must not become null)
    await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      token
    )
      .send({ priceCents: 0 })
      .expect(200);

    const { price: afterZero, body: afterZeroBody } = await fetchPriceFromApi(app, token, draftId);
    if (afterZero === undefined) {
      // eslint-disable-next-line no-console
      console.log('DEBUG: GET /api/ads/:id response does not contain priceCents/price_cents:', afterZeroBody);
    }
    expect(afterZero).toBe(0);

    // D) PATCH draft: priceCents = null must remain null
    await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      token
    )
      .send({ priceCents: null })
      .expect(200);

    const { price: afterNull, body: afterNullBody } = await fetchPriceFromApi(app, token, draftId);
    if (afterNull === undefined) {
      // eslint-disable-next-line no-console
      console.log('DEBUG: GET /api/ads/:id response does not contain priceCents/price_cents:', afterNullBody);
    }
    expect(afterNull).toBe(null);
  });
});
