// backend/tests/ads.rules.int.test.js
'use strict';

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

function uuidLike(v) {
  return typeof v === 'string' && /[0-9a-f-]{36}/i.test(v);
}

async function createDraft({ token, locationId, title, description, priceCents }) {
  const res = await withAuth(
    request(app).post('/api/ads').set('Content-Type', 'application/json'),
    token
  )
    .send({ locationId, title, description, priceCents })
    .expect(201);

  const id = res.body?.id;
  expect(uuidLike(id)).toBe(true);
  return id;
}

async function addPhoto({ token, adId, filePath = 'uploads/smoke.jpg', sortOrder = 0 }) {
  const res = await withAuth(
    request(app).post(`/api/ads/${adId}/photos`).set('Content-Type', 'application/json'),
    token
  )
    .send({ filePath, sortOrder })
    .expect(201);

  const photos = res.body?.data?.photos || [];
  expect(photos.length).toBeGreaterThanOrEqual(1);
  return photos;
}

async function publish({ token, adId }) {
  const res = await withAuth(request(app).post(`/api/ads/${adId}/publish`), token).expect(200);
  return res.body;
}

async function stop({ token, adId, expectedStatus = 200 }) {
  const req = withAuth(request(app).post(`/api/ads/${adId}/stop`), token);
  const res = await req.expect(expectedStatus);
  return res.body;
}

async function restart({ token, adId, expectedStatus = 200 }) {
  const req = withAuth(request(app).post(`/api/ads/${adId}/restart`), token);
  const res = await req.expect(expectedStatus);
  return res.body;
}

async function forkPatch({ token, adId, patch, expectedStatus = 200 }) {
  const req = withAuth(request(app).patch(`/api/ads/${adId}`).set('Content-Type', 'application/json'), token)
    .send(patch);
  const res = await req.expect(expectedStatus);
  return res.body;
}

describe('Ads business rules (integration)', () => {
  let ownerToken;
  let otherToken;
  let locationId;

  beforeAll(async () => {
    await resetDb();
    locationId = await ensureTestLocation();

    const stamp = Date.now();

    ownerToken = await registerAndLogin(app, {
      email: `jest_owner_${stamp}@example.com`,
      password: 'password123',
      name: 'Owner User'
    });

    otherToken = await registerAndLogin(app, {
      email: `jest_other_${stamp}@example.com`,
      password: 'password123',
      name: 'Other User'
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  test('stop: draft cannot be stopped (409)', async () => {
    const draftId = await createDraft({
      token: ownerToken,
      locationId,
      title: 'Stop draft',
      description: 'Stop draft description 1234567890',
      priceCents: 100
    });

    const body = await stop({ token: ownerToken, adId: draftId, expectedStatus: 409 });
    expect(body?.error).toBe('NOT_ALLOWED');
  });

  test('stop: non-owner cannot stop (404)', async () => {
    const draftId = await createDraft({
      token: ownerToken,
      locationId,
      title: 'Stop чужой',
      description: 'Stop чужой description 1234567890',
      priceCents: 100
    });

    await addPhoto({ token: ownerToken, adId: draftId });
    await publish({ token: ownerToken, adId: draftId });

    // other user tries to stop => 404 (not found)
    const body = await stop({ token: otherToken, adId: draftId, expectedStatus: 404 });
    expect(body?.error).toBe('NOT_FOUND');
  });

  test('fork active: cannot fork if old ad already replaced (409)', async () => {
    // create + publish
    const draftId = await createDraft({
      token: ownerToken,
      locationId,
      title: 'Fork replaced',
      description: 'Fork replaced description 1234567890',
      priceCents: 500
    });
    await addPhoto({ token: ownerToken, adId: draftId });
    await publish({ token: ownerToken, adId: draftId });

    // first fork succeeds (active -> new active, old becomes stopped and linked)
    const firstFork = await forkPatch({
      token: ownerToken,
      adId: draftId,
      patch: {
        title: 'Fork 1',
        description: 'Fork 1 description 1234567890',
        priceCents: '600'
      },
      expectedStatus: 200
    });

    expect(firstFork?.notice?.mode).toBe('forked');
    const newActiveId = firstFork?.data?.newAdId;
    expect(uuidLike(newActiveId)).toBe(true);

    // second fork on the SAME original id must fail (already replaced)
    const secondFork = await forkPatch({
      token: ownerToken,
      adId: draftId,
      patch: {
        title: 'Fork 2',
        description: 'Fork 2 description 1234567890'
      },
      expectedStatus: 409
    });

    expect(secondFork?.error).toBe('NOT_ALLOWED');
    expect(String(secondFork?.message || '')).toMatch(/already replaced/i);
  });

  test('fork stopped: cannot fork if old stopped ad already replaced (409)', async () => {
    // create + publish
    const draftId = await createDraft({
      token: ownerToken,
      locationId,
      title: 'Fork stopped replaced',
      description: 'Fork stopped replaced description 1234567890',
      priceCents: 900
    });
    await addPhoto({ token: ownerToken, adId: draftId });
    await publish({ token: ownerToken, adId: draftId });

    // fork active => old becomes stopped, new becomes active
    const fork1 = await forkPatch({
      token: ownerToken,
      adId: draftId,
      patch: { title: 'Active v2', description: 'Active v2 description 1234567890' },
      expectedStatus: 200
    });

    const activeV2Id = fork1?.data?.newAdId;
    expect(uuidLike(activeV2Id)).toBe(true);

    // stop activeV2
    const stopped = await stop({ token: ownerToken, adId: activeV2Id, expectedStatus: 200 });
    expect(stopped?.status).toBe('stopped');

    // fork stopped => creates NEW DRAFT, and stopped gets replaced_by_ad_id
    const forkStopped = await forkPatch({
      token: ownerToken,
      adId: activeV2Id,
      patch: { title: 'Draft v3', description: 'Draft v3 description 1234567890', priceCents: '' },
      expectedStatus: 200
    });

    const newDraftId = forkStopped?.data?.newAdId;
    expect(uuidLike(newDraftId)).toBe(true);
    expect(forkStopped?.data?.newStatus).toBe('draft');

    // second fork on the same stopped id must fail (already replaced)
    const second = await forkPatch({
      token: ownerToken,
      adId: activeV2Id,
      patch: { title: 'Draft v4', description: 'Draft v4 description 1234567890' },
      expectedStatus: 409
    });

    expect(second?.error).toBe('NOT_ALLOWED');
    expect(String(second?.message || '')).toMatch(/already replaced/i);
  });

  test('publish: priceCents=0 and priceCents=null are allowed', async () => {
    // A) priceCents = 0
    const d0 = await createDraft({
      token: ownerToken,
      locationId,
      title: 'Publish price 0',
      description: 'Publish price 0 description 1234567890',
      priceCents: 0
    });
    await addPhoto({ token: ownerToken, adId: d0 });
    const p0 = await publish({ token: ownerToken, adId: d0 });
    expect(p0?.status).toBe('active');
    expect(p0?.published_at).toBeTruthy();

    // B) priceCents = null
    const dn = await createDraft({
      token: ownerToken,
      locationId,
      title: 'Publish price null',
      description: 'Publish price null description 1234567890',
      priceCents: null
    });
    await addPhoto({ token: ownerToken, adId: dn });
    const pn = await publish({ token: ownerToken, adId: dn });
    expect(pn?.status).toBe('active');
    expect(pn?.published_at).toBeTruthy();
  });

  // Если решим правилом: "нельзя restart, если объявление уже replaced"
  // (иначе можно получить две актуальные ветки)
  test.skip('restart: stopped + replaced_by_ad_id => 409 (rule)', async () => {
    // create + publish
    const draftId = await createDraft({
      token: ownerToken,
      locationId,
      title: 'Restart replaced',
      description: 'Restart replaced description 1234567890',
      priceCents: 100
    });
    await addPhoto({ token: ownerToken, adId: draftId });
    await publish({ token: ownerToken, adId: draftId });

    // fork active => original becomes stopped + replaced
    await forkPatch({
      token: ownerToken,
      adId: draftId,
      patch: { title: 'v2', description: 'v2 description 1234567890' },
      expectedStatus: 200
    });

    // try restart original stopped (should be forbidden by rule)
    const body = await restart({ token: ownerToken, adId: draftId, expectedStatus: 409 });
    expect(body?.error).toBe('NOT_ALLOWED');
  });
});
