'use strict';

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

describe('Ads versions timeline UX (integration)', () => {
  let ownerToken;
  let viewerToken;
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

    viewerToken = await registerAndLogin(app, {
      email: `jest_viewer_${stamp}@example.com`,
      password: 'password123',
      name: 'Viewer User'
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  test('owner versions: latestPublishedAdId + exactly one isLatestPublished=true', async () => {
    // 1) create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Versions owner',
        description: 'Versions owner description 1234567890',
        priceCents: 1000
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // 2) add photo
    await withAuth(
      request(app).post(`/api/ads/${draftId}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    // 3) publish -> active (same id becomes active)
    await withAuth(request(app).post(`/api/ads/${draftId}/publish`), ownerToken).expect(200);

    // 4) patch active -> fork active (new active, old becomes stopped)
    const forkActiveRes = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Versions owner (EDIT)',
        description: 'Versions owner edited description 1234567890',
        priceCents: '1200'
      })
      .expect(200);

    const newActiveId = forkActiveRes.body?.data?.newAdId;
    expect(newActiveId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkActiveRes.body?.data?.newStatus).toBe('active');

    // 5) stop new active -> stopped
    await withAuth(request(app).post(`/api/ads/${newActiveId}/stop`), ownerToken).expect(200);

    // 6) patch stopped -> fork draft (new draft)
    const forkStoppedRes = await withAuth(
      request(app).patch(`/api/ads/${newActiveId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Stopped -> edit',
        description: 'Stopped -> edit description 1234567890',
        priceCents: ''
      })
      .expect(200);

    const newDraftId = forkStoppedRes.body?.data?.newAdId;
    expect(newDraftId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkStoppedRes.body?.data?.newStatus).toBe('draft');

    // 7) versions from latest draft (owner)
    const versionsRes = await withAuth(
      request(app).get(`/api/ads/${newDraftId}/versions`),
      ownerToken
    ).expect(200);

    const data = versionsRes.body?.data;
    expect(data?.isOwner).toBe(true);
    expect(data?.currentAdId).toBe(newDraftId);

    // ✅ New UX fields
    expect(data?.latestPublishedAdId).toMatch(/[0-9a-f-]{36}/i);

    expect(Array.isArray(data?.timeline)).toBe(true);
    expect(data.timeline.length).toBeGreaterThanOrEqual(3);

    const cur = data.timeline.find((x) => x.isCurrent);
    expect(cur?.id).toBe(newDraftId);

    // exactly one latest-published marker
    const latestMarked = data.timeline.filter((x) => x.isLatestPublished === true);
    expect(latestMarked.length).toBe(1);

    const latest = latestMarked[0];
    expect(latest?.status).toBe('active');
    expect(latest?.id).toBe(data.latestPublishedAdId);
  });

  test('non-owner versions: allowed only for active + timeline must not leak draft/stopped', async () => {
    // Build a chain but keep the current one ACTIVE for public view.
    // 1) create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Versions public',
        description: 'Versions public description 1234567890',
        priceCents: 500
      })
      .expect(201);

    const draftId = createRes.body?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    // 2) add photo
    await withAuth(
      request(app).post(`/api/ads/${draftId}/photos`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    // 3) publish -> active
    await withAuth(request(app).post(`/api/ads/${draftId}/publish`), ownerToken).expect(200);

    // 4) fork active -> new active (keep it active; do NOT stop it)
    const forkActiveRes = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Versions public (EDIT)',
        description: 'Versions public edited description 1234567890',
        priceCents: 600
      })
      .expect(200);

    const newActiveId = forkActiveRes.body?.data?.newAdId;
    expect(newActiveId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkActiveRes.body?.data?.newStatus).toBe('active');

    // 5) non-owner requests versions for ACTIVE ad
    const versionsRes = await withAuth(
      request(app).get(`/api/ads/${newActiveId}/versions`),
      viewerToken
    ).expect(200);

    const data = versionsRes.body?.data;

    expect(data?.isOwner).toBe(false);
    expect(data?.currentAdId).toBe(newActiveId);

    expect(Array.isArray(data?.timeline)).toBe(true);
    expect(data.timeline.length).toBeGreaterThanOrEqual(1);

    // ✅ public must not see drafts/stopped
    for (const v of data.timeline) {
      expect(v.status).toBe('active');
    }

    // ✅ latestPublishedAdId should exist and point to an active
    expect(data?.latestPublishedAdId).toMatch(/[0-9a-f-]{36}/i);
    const latest = data.timeline.find((x) => x.id === data.latestPublishedAdId);
    expect(latest?.status).toBe('active');
  });
});
