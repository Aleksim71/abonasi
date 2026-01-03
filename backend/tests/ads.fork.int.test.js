'use strict';

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

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

    const draftId = createRes.body?.data?.id;
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
    const forkActiveRes = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      token
    )
      .send({ title: 'Smoke A (EDIT)', description: 'Smoke A edited description 1234567890' })
      .expect(200);

    expect(forkActiveRes.body?.notice?.mode).toBe('forked');
    const newActiveId = forkActiveRes.body?.data?.newAdId;
    expect(newActiveId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkActiveRes.body?.data?.newStatus).toBe('active');

    // E) stop new active
    const stoppedRes = await withAuth(
      request(app).post(`/api/ads/${newActiveId}/stop`),
      token
    ).expect(200);
    expect(stoppedRes.body?.data?.status).toBe('stopped');

    // F) PATCH stopped -> fork (must create NEW DRAFT)
    const forkStoppedRes = await withAuth(
      request(app).patch(`/api/ads/${newActiveId}`).set('Content-Type', 'application/json'),
      token
    )
      .send({ title: 'Stopped -> edit', description: 'Stopped -> edit description 1234567890' })
      .expect(200);

    const newDraftId = forkStoppedRes.body?.data?.newAdId;
    expect(newDraftId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkStoppedRes.body?.data?.newStatus).toBe('draft');

    // G) versions timeline from latest draft
    const versionsRes = await withAuth(
      request(app).get(`/api/ads/${newDraftId}/versions`),
      token
    ).expect(200);

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
});
