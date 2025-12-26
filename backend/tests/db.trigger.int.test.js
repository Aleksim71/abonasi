'use strict';

const { pool, resetDb, ensureTestLocation, closeDb } = require('./helpers/db');

describe('DB trigger ads_prevent_update_non_draft (integration)', () => {
  let locationId;
  let userId;
  let adId;

  beforeAll(async () => {
    await resetDb();
    locationId = await ensureTestLocation();

    // create user directly (faster than API)
    const u = await pool.query(
      `
      INSERT INTO users (email, name, password_hash)
      VALUES ('trigger_test@example.com','Trigger Test','hash')
      RETURNING id
      `
    );
    userId = u.rows[0].id;

    // create draft ad (title must satisfy ads_title_check: 3..120)
    const a = await pool.query(
      `
      INSERT INTO ads (user_id, location_id, title, description, price_cents, status)
      VALUES ($1,$2,'Test','Description 1234567890',1000,'draft')
      RETURNING id
      `,
      [userId, locationId]
    );
    adId = a.rows[0].id;

    // publish -> active (non-draft)
    await pool.query(
      `
      UPDATE ads
      SET status='active', published_at=now()
      WHERE id=$1
      `,
      [adId]
    );

    // add a photo (not required for trigger, but harmless)
    await pool.query(
      `INSERT INTO ad_photos (ad_id, file_path, sort_order) VALUES ($1,'uploads/x.jpg',0)`,
      [adId]
    );
  });

  afterAll(async () => {
    await closeDb();
  });

  test('direct UPDATE of non-draft is blocked by trigger', async () => {
    let err;
    try {
      await pool.query(`UPDATE ads SET title='HACK' WHERE id=$1`, [adId]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeTruthy();
    expect(String(err.message || '')).toMatch(/Only draft ads can be updated/i);
  });

  test('UPDATE inside transaction with SET LOCAL bypass is allowed', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL app.allow_non_draft_update = '1'`);
      await client.query(`UPDATE ads SET title='SYSTEM_OK' WHERE id=$1`, [adId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const r = await pool.query(`SELECT title FROM ads WHERE id=$1`, [adId]);
    expect(r.rows[0].title).toBe('SYSTEM_OK');
  });
});
