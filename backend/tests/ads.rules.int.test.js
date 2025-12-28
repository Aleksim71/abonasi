'use strict';

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

describe('Ads business rules (integration)', () => {
  let ownerToken;
  let otherToken;
  let locationId;

  beforeAll(async () => {
    // Keep locations seed, reset other tables
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
    // create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Stop draft',
        description: 'Stop draft description 1234567890',
        priceCents: 100
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // stop draft -> 409
    const r = await withAuth(request(app).post(`/api/ads/${draftId}/stop`), ownerToken).expect(409);
    expect(r.body?.error).toBe('NOT_ALLOWED');
  });

  test('stop: non-owner cannot stop (404)', async () => {
    // create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Stop non-owner',
        description: 'Stop non-owner description 1234567890',
        priceCents: 200
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // add photo
    await withAuth(
      request(app).post(`/api/ads/${draftId}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    // publish -> active
    await withAuth(request(app).post(`/api/ads/${draftId}/publish`), ownerToken).expect(200);

    // other user tries to stop -> 404 (not found / no leak)
    await withAuth(request(app).post(`/api/ads/${draftId}/stop`), otherToken).expect(404);
  });

  test('fork active: cannot fork if old ad already replaced (409)', async () => {
    // create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Fork active replaced',
        description: 'Fork active replaced description 1234567890',
        priceCents: 300
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // add photo
    await withAuth(
      request(app).post(`/api/ads/${draftId}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    // publish -> active
    await withAuth(request(app).post(`/api/ads/${draftId}/publish`), ownerToken).expect(200);

    // fork active (PATCH) -> creates new active + old stopped
    const fork1 = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Fork active replaced (edit 1)',
        description: 'Fork active replaced (edit 1) description 1234567890',
        priceCents: 350
      })
      .expect(200);

    expect(fork1.body?.notice?.mode).toBe('forked');

    // fork the same old ad again -> 409
    const fork2 = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Fork active replaced (edit 2)',
        description: 'Fork active replaced (edit 2) description 1234567890',
        priceCents: 360
      })
      .expect(409);

    expect(fork2.body?.error).toBe('NOT_ALLOWED');
  });

  test('fork stopped: cannot fork if old stopped ad already replaced (409)', async () => {
    // create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Fork stopped replaced',
        description: 'Fork stopped replaced description 1234567890',
        priceCents: 400
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // add photo
    await withAuth(
      request(app).post(`/api/ads/${draftId}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    // publish -> active
    await withAuth(request(app).post(`/api/ads/${draftId}/publish`), ownerToken).expect(200);

    // stop -> stopped
    await withAuth(request(app).post(`/api/ads/${draftId}/stop`), ownerToken).expect(200);

    // fork stopped -> creates new DRAFT + links replaced_by on old stopped
    const fork1 = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Fork stopped replaced (edit 1)',
        description: 'Fork stopped replaced (edit 1) description 1234567890',
        priceCents: 410
      })
      .expect(200);

    expect(fork1.body?.notice?.mode).toBe('forked');

    // fork same stopped again -> 409
    const fork2 = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Fork stopped replaced (edit 2)',
        description: 'Fork stopped replaced (edit 2) description 1234567890',
        priceCents: 420
      })
      .expect(409);

    expect(fork2.body?.error).toBe('NOT_ALLOWED');
  });

  test('publish: priceCents=0 and priceCents=null are allowed', async () => {
    // A) priceCents=0
    const create0 = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Price 0',
        description: 'Price 0 description 1234567890',
        priceCents: 0
      })
      .expect(201);

    const id0 = create0.body?.id;
    expect(id0).toMatch(/[0-9a-f-]{36}/i);

    await withAuth(
      request(app).post(`/api/ads/${id0}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    await withAuth(request(app).post(`/api/ads/${id0}/publish`), ownerToken).expect(200);

    // B) priceCents=null
    const createNull = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Price null',
        description: 'Price null description 1234567890',
        priceCents: null
      })
      .expect(201);

    const idNull = createNull.body?.id;
    expect(idNull).toMatch(/[0-9a-f-]{36}/i);

    await withAuth(
      request(app).post(`/api/ads/${idNull}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    await withAuth(request(app).post(`/api/ads/${idNull}/publish`), ownerToken).expect(200);
  });

  test('restart: stopped + replaced_by_ad_id => 409 (rule)', async () => {
    // 1) create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Restart replaced rule',
        description: 'Restart replaced rule description 1234567890',
        priceCents: 999
      })
      .expect(201);

    const adId = createRes.body?.id;
    expect(adId).toMatch(/[0-9a-f-]{36}/i);

    // 2) add photo
    await withAuth(
      request(app).post(`/api/ads/${adId}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    // 3) publish -> active
    await withAuth(request(app).post(`/api/ads/${adId}/publish`), ownerToken).expect(200);

    // 4) stop -> stopped
    await withAuth(request(app).post(`/api/ads/${adId}/stop`), ownerToken).expect(200);

    // 5) fork stopped -> creates new draft and sets replaced_by on old stopped
    const fork = await withAuth(
      request(app).patch(`/api/ads/${adId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Restart replaced rule (fork)',
        description: 'Restart replaced rule (fork) description 1234567890',
        priceCents: 1000
      })
      .expect(200);

    expect(fork.body?.notice?.mode).toBe('forked');

    // 6) restart old stopped which is already replaced -> 409
    const r = await withAuth(request(app).post(`/api/ads/${adId}/restart`), ownerToken).expect(409);
    expect(r.body?.error).toBe('NOT_ALLOWED');
  });
});
