'use strict';

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

describe('Ads versions timeline UX (integration)', () => {
  let locationId;
  let ownerToken;
  let otherToken;

  beforeAll(async () => {
    await resetDb();
    locationId = await ensureTestLocation();

    const stamp = Date.now();

    ownerToken = await registerAndLogin(app, {
      email: `owner_${stamp}@example.com`,
      password: 'password123',
      name: 'Owner'
    });

    otherToken = await registerAndLogin(app, {
      email: `other_${stamp}@example.com`,
      password: 'password123',
      name: 'Other'
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  test('owner versions: latestPublishedAdId + currentPublishedAdId markers', async () => {
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

    const draftId = createRes.body?.data?.id;
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

    // 4) edit active -> fork active (newActive) + old stopped
    const forkActiveRes = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Versions owner (EDIT)',
        description: 'Versions owner edited description 1234567890',
        priceCents: 1200
      })
      .expect(200);

    const newActiveId = forkActiveRes.body?.data?.newAdId;
    expect(newActiveId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkActiveRes.body?.data?.newStatus).toBe('active');

    // 5) stop new active
    await withAuth(request(app).post(`/api/ads/${newActiveId}/stop`), ownerToken).expect(200);

    // 6) edit stopped -> fork draft (newDraft)
    const forkStoppedRes = await withAuth(
      request(app).patch(`/api/ads/${newActiveId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Stopped -> edit',
        description: 'Stopped -> edit description 1234567890',
        priceCents: null
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

    // UX fields
    expect(data?.latestPublishedAdId).toMatch(/[0-9a-f-]{36}/i);
    // there is no active now, so currentPublishedAdId must be null
    expect(data?.currentPublishedAdId).toBe(null);

    expect(Array.isArray(data?.timeline)).toBe(true);
    expect(data.timeline.length).toBeGreaterThanOrEqual(3);

    // current marker
    const cur = data.timeline.find((x) => x.isCurrent);
    expect(cur?.id).toBe(newDraftId);

    // exactly one latest-published marker
    const latestMarked = data.timeline.filter((x) => x.isLatestPublished === true);
    expect(latestMarked.length).toBe(1);
    expect(latestMarked[0]?.id).toBe(data.latestPublishedAdId);
    expect(latestMarked[0]?.publishedAt).toBeTruthy();

    // no currentPublished markers if no active exists
    const currentPubMarked = data.timeline.filter((x) => x.isCurrentPublished === true);
    expect(currentPubMarked.length).toBe(0);
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

    const draftId = createRes.body?.data?.id;
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

    // 4) edit active -> fork active (newActive) + old stopped
    const forkActiveRes = await withAuth(
      request(app).patch(`/api/ads/${draftId}`).set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        title: 'Versions public (EDIT)',
        description: 'Versions public edited description 1234567890',
        priceCents: 700
      })
      .expect(200);

    const newActiveId = forkActiveRes.body?.data?.newAdId;
    expect(newActiveId).toMatch(/[0-9a-f-]{36}/i);
    expect(forkActiveRes.body?.data?.newStatus).toBe('active');

    // 5) public versions доступен только для active
    const versionsRes = await withAuth(
      request(app).get(`/api/ads/${newActiveId}/versions`),
      otherToken
    ).expect(200);

    const data = versionsRes.body?.data;
    expect(data?.isOwner).toBe(false);

    // public should see active-only timeline
    expect(Array.isArray(data?.timeline)).toBe(true);
    expect(data.timeline.length).toBeGreaterThanOrEqual(1);

    for (const v of data.timeline) {
      expect(v.status).toBe('active');
    }

    // public markers: currentPublished exists and must be active
    expect(data?.currentPublishedAdId).toMatch(/[0-9a-f-]{36}/i);
    const currentPub = data.timeline.find((x) => x.isCurrentPublished === true);
    expect(currentPub?.id).toBe(data.currentPublishedAdId);
    expect(currentPub?.status).toBe('active');

    // latestPublished exists too (could equal currentPublished in public case)
    expect(data?.latestPublishedAdId).toMatch(/[0-9a-f-]{36}/i);
    const latestMarked = data.timeline.filter((x) => x.isLatestPublished === true);
    expect(latestMarked.length).toBe(1);
  });

  test('non-owner versions: 404 for non-active ad', async () => {
    // create a draft and try to access versions as non-owner -> 404
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      ownerToken
    )
      .send({
        locationId,
        title: 'Versions private',
        description: 'Versions private description 1234567890',
        priceCents: 100
      })
      .expect(201);

    const draftId = createRes.body?.data?.id;
    expect(draftId).toMatch(/[0-9a-f-]{36}/i);

    await withAuth(request(app).get(`/api/ads/${draftId}/versions`), otherToken).expect(404);
  });
});
