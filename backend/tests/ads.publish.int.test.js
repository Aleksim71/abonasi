'use strict';

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

describe('Ads publish rules (integration)', () => {
  let token;
  let locationId;

  beforeAll(async () => {
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

  test('cannot publish draft without photos', async () => {
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    )
      .send({
        locationId,
        title: 'No photos',
        description: 'Draft without photos 1234567890',
        priceCents: 1000
      })
      .expect(201);

    const adId = createRes.body?.data?.id;
    expect(adId).toMatch(/[0-9a-f-]{36}/i);

    const pubRes = await withAuth(request(app).post(`/api/ads/${adId}/publish`), token).expect(409);
    expect(pubRes.body?.error).toBe('NOT_ALLOWED');
  });

  test('cannot publish non-draft (second publish)', async () => {
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    )
      .send({
        locationId,
        title: 'Publish once',
        description: 'Draft with photo 1234567890',
        priceCents: 1000
      })
      .expect(201);

    const adId = createRes.body?.data?.id;
    expect(adId).toMatch(/[0-9a-f-]{36}/i);

    await withAuth(
      request(app).post(`/api/ads/${adId}/photos`).set('Content-Type', 'application/json'),
      token
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    // first publish ok
    const first = await withAuth(request(app).post(`/api/ads/${adId}/publish`), token).expect(200);
    expect(first.body?.data?.status).toBe('active');

    // second publish forbidden
    const second = await withAuth(request(app).post(`/api/ads/${adId}/publish`), token).expect(409);
    expect(second.body?.error).toBe('NOT_ALLOWED');
  });

  test('publish ok: returns active + published_at set', async () => {
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    )
      .send({
        locationId,
        title: 'Publish OK',
        description: 'This draft is ready to be published 1234567890',
        priceCents: 0
      })
      .expect(201);

    const adId = createRes.body?.data?.id;
    expect(adId).toMatch(/[0-9a-f-]{36}/i);

    await withAuth(
      request(app).post(`/api/ads/${adId}/photos`).set('Content-Type', 'application/json'),
      token
    )
      .send({ filePath: 'uploads/smoke.jpg', sortOrder: 0 })
      .expect(201);

    const pubRes = await withAuth(request(app).post(`/api/ads/${adId}/publish`), token).expect(200);

    expect(pubRes.body?.data?.status).toBe('active');
    expect(pubRes.body?.data?.publishedAt || pubRes.body?.publishedAt).toBeTruthy();
  });
});
