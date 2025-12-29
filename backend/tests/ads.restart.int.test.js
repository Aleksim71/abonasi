'use strict';

/**
 * Restart UX / response-shape integration tests
 *
 * File: backend/tests/ads.restart.int.test.js
 *
 * D2 goals:
 * - POST /api/ads/:id/restart returns stable shape: { data: { ad, notice? } }
 * - After restart: status=active, stoppedAt=null
 * - restart forbidden cases keep consistent error codes
 *
 * Repo-specific:
 * - POST /api/ads/:id/photos expects JSON { filePath }
 *
 * NOTE:
 * - "replaced stopped -> 409" is already covered by tests/ads.rules.int.test.js
 *   and does not need to be repeated here (avoids coupling to fork endpoint route).
 */

const app = require('../src/app');
const { resetDb, ensureTestLocation, closeDb } = require('./helpers/db');
const { request, withAuth, registerAndLogin } = require('./helpers/http');

function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

function pickAdIdFromCreateResponse(createRes) {
  const b = createRes?.body;

  const candidates = [
    b?.data?.ad?.id,
    b?.data?.adId,
    b?.data?.id,
    b?.ad?.id,
    b?.adId,
    b?.id,
    b?.result?.ad?.id,
    b?.result?.id,
    b?.data?.result?.ad?.id,
    b?.data?.result?.id
  ];

  const id = candidates.find((v) => typeof v === 'string' && v.trim().length > 0);
  if (id) return id;

  throw new Error(
    [
      'Could not extract adId from POST /api/ads response.',
      `status=${createRes?.status}`,
      'Body was:',
      safeJson(b)
    ].join('\n')
  );
}

/**
 * Attach photo to ad (test-style).
 * Backend expects JSON with `filePath`.
 */
async function uploadPhoto({ token, adId }) {
  const endpoint = `/api/ads/${adId}/photos`;
  const filePath = `uploads/tests/${adId}.jpg`;

  const res = await withAuth(
    request(app).post(endpoint).set('Content-Type', 'application/json'),
    token
  ).send({ filePath });

  if (!(res.status >= 200 && res.status < 300)) {
    throw new Error(
      [
        `Photo attach failed: POST ${endpoint}`,
        `status=${res.status}`,
        `body=${safeJson(res.body)}`,
        `sent={ "filePath": "${filePath}" }`
      ].join('\n')
    );
  }

  return res.body;
}

function expectRestartResponseShape(body) {
  expect(body).toBeTruthy();
  expect(body).toHaveProperty('data');
  expect(body.data).toHaveProperty('ad');

  if (body.data.notice != null) {
    expect(body.data.notice).toHaveProperty('code');
    expect(typeof body.data.notice.code).toBe('string');
  }
}

function expectAdDtoBasics(ad) {
  expect(ad).toHaveProperty('id');
  expect(typeof ad.id).toBe('string');

  expect(ad).toHaveProperty('status');
  expect(['draft', 'active', 'stopped', 'replaced'].includes(ad.status)).toBe(true);

  // D2: camelCase contract
  expect(ad).toHaveProperty('publishedAt');
  expect(ad).toHaveProperty('stoppedAt');
  expect(ad).toHaveProperty('replacedByAdId');
  expect(ad).toHaveProperty('priceCents');
}

describe('Ads restart UX (integration)', () => {
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

  test('restart stopped (not replaced) -> 200, becomes active, stoppedAt cleared, stable response shape', async () => {
    // create draft
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    ).send({
      locationId,
      title: 'Restart UX test ad',
      description: 'Restart flow: draft -> publish -> stop -> restart',
      priceCents: null
    });

    expect(createRes.status).toBe(201);
    const adId = pickAdIdFromCreateResponse(createRes);

    // attach photo
    await uploadPhoto({ token, adId });

    // publish -> active
    const publishRes = await withAuth(request(app).post(`/api/ads/${adId}/publish`), token);
    if (publishRes.status !== 200) {
      throw new Error(
        `Expected publish 200, got ${publishRes.status}\nBody:\n${safeJson(publishRes.body)}`
      );
    }

    // stop -> stopped
    const stopRes = await withAuth(request(app).post(`/api/ads/${adId}/stop`), token);
    if (stopRes.status !== 200) {
      throw new Error(
        `Expected stop 200, got ${stopRes.status}\nBody:\n${safeJson(stopRes.body)}`
      );
    }

    // restart -> active
    const restartRes = await withAuth(request(app).post(`/api/ads/${adId}/restart`), token);
    if (restartRes.status !== 200) {
      throw new Error(
        `Expected restart 200, got ${restartRes.status}\nBody:\n${safeJson(restartRes.body)}`
      );
    }

    expectRestartResponseShape(restartRes.body);
    const { ad, notice } = restartRes.body.data;

    expectAdDtoBasics(ad);

    expect(ad.status).toBe('active');
    expect(ad.stoppedAt).toBe(null);
    expect(ad.replacedByAdId).toBe(null);

    if (notice != null) {
      expect(typeof notice.code).toBe('string');
    }
  });

  test('restart draft -> 409 (contract: error shape)', async () => {
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    ).send({
      locationId,
      title: 'Restart forbidden draft',
      description: 'Should not restart draft',
      priceCents: 0
    });

    expect(createRes.status).toBe(201);
    const adId = pickAdIdFromCreateResponse(createRes);

    const res = await withAuth(request(app).post(`/api/ads/${adId}/restart`), token);

    expect(res.status).toBe(409);
    expect(res.body).toBeTruthy();
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message');
  });

  test('restart active -> 409 (contract: error shape)', async () => {
    const createRes = await withAuth(
      request(app).post('/api/ads').set('Content-Type', 'application/json'),
      token
    ).send({
      locationId,
      title: 'Restart forbidden active',
      description: 'Publish then attempt restart while active',
      priceCents: null
    });

    expect(createRes.status).toBe(201);
    const adId = pickAdIdFromCreateResponse(createRes);

    await uploadPhoto({ token, adId });

    const publishRes = await withAuth(request(app).post(`/api/ads/${adId}/publish`), token);
    if (publishRes.status !== 200) {
      throw new Error(
        `Expected publish 200, got ${publishRes.status}\nBody:\n${safeJson(publishRes.body)}`
      );
    }

    const res = await withAuth(request(app).post(`/api/ads/${adId}/restart`), token);

    expect(res.status).toBe(409);
    expect(res.body).toBeTruthy();
    expect(res.body).toHaveProperty('error');
    expect(res.body).toHaveProperty('message');
  });
});
