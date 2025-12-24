'use strict';

const request = require('supertest');

function withAuth(r, token) {
  return r.set('Authorization', `Bearer ${token}`);
}

async function registerAndLogin(app, { email, password, name }) {
  // register (ignore conflict)
  await request(app)
    .post('/api/auth/register')
    .send({ email, password, name })
    .set('Content-Type', 'application/json');

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .set('Content-Type', 'application/json');

  if (loginRes.status !== 200) {
    // 👇 это даст нам причину 500
    throw new Error(
      `Login failed: status=${loginRes.status} body=${JSON.stringify(loginRes.body)} text=${loginRes.text}`
    );
  }

  const token = loginRes.body?.token || loginRes.body?.data?.token;
  if (!token) {
    throw new Error(`Login response did not contain token. Body: ${JSON.stringify(loginRes.body)}`);
  }
  return token;
}

module.exports = {
  request,
  withAuth,
  registerAndLogin
};
