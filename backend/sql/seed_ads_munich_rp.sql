-- backend/sql/seed_ads_munich_rp.sql
-- Seed ~10 demo ACTIVE ads for: Germany / Munich / Ramersdorf-Perlach
-- Safe to re-run: deletes previous DEMO ads for this location+demo user.

BEGIN;

-- 1) Ensure location exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM locations
    WHERE country='Germany' AND city='Munich' AND district='Ramersdorf-Perlach'
  ) THEN
    RAISE EXCEPTION 'Location not found: Germany/Munich/Ramersdorf-Perlach';
  END IF;
END $$;

-- 2) Upsert demo user (for demo content)
WITH u AS (
  INSERT INTO users (email, password_hash, name)
  VALUES ('demo@abonasi.local', 'demo-not-login', 'Demo User')
  ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
  RETURNING id
),
l AS (
  SELECT id AS location_id
  FROM locations
  WHERE country='Germany' AND city='Munich' AND district='Ramersdorf-Perlach'
  LIMIT 1
),
del AS (
  DELETE FROM ads
  WHERE user_id = (SELECT id FROM u)
    AND location_id = (SELECT location_id FROM l)
    AND title LIKE '[DEMO] %'
  RETURNING id
)
SELECT COUNT(*) AS deleted_demo_ads FROM del;

-- 3) Insert 10 ACTIVE ads
WITH u AS (
  SELECT id FROM users WHERE email='demo@abonasi.local' LIMIT 1
),
l AS (
  SELECT id AS location_id
  FROM locations
  WHERE country='Germany' AND city='Munich' AND district='Ramersdorf-Perlach'
  LIMIT 1
),
src AS (
  SELECT
    gs AS n,
    (ARRAY[
      'Продам велосипед городской',
      'Отдам стул бесплатно',
      'Сдам комнату на 1 месяц',
      'Ищу мастера по ремонту',
      'Продам монитор 24"',
      'Детская коляска в хорошем состоянии',
      'Продам книги (набор)',
      'Услуги перевозки / помощь с переездом',
      'Курсы немецкого: разговорная практика',
      'Продам кофемашину'
    ])[gs] AS base_title,
    (ARRAY[
      'Состояние хорошее, без серьёзных дефектов. Самовывоз в районе. Пишите в чат, договоримся.',
      'Можно забрать сегодня/завтра. Чисто, целое. Самовывоз. Если нужно — помогу вынести.',
      'Тихая комната, рядом транспорт. Краткосрочно. Напишите несколько слов о себе.',
      'Нужно аккуратно и по договорённости. Опишите задачу, пришлите фото/детали.',
      'Работает отлично, без битых пикселей. Кабель в комплекте. Проверка при встрече.',
      'После одного ребёнка. Чистая, всё работает. Есть корзина и накидка.',
      'Разные жанры, состояние нормальное. Отдам комплектом или частями.',
      'Помогу с переносом коробок, небольшими перевозками. По времени договоримся.',
      'Практика 1-на-1, уровень A2–B2. Онлайн/офлайн в районе. Пишите!',
      'Исправная, обслужена. Причина продажи: обновление техники. Проверка на месте.'
    ])[gs] AS base_desc,
    (ARRAY[ 4900, 0, 35000, 0, 8900, 12000, 2500, 0, 1500, 19900 ])[gs] AS price_cents
  FROM generate_series(1,10) AS gs
)
INSERT INTO ads (user_id, location_id, title, description, price_cents, status, published_at)
SELECT
  (SELECT id FROM u),
  (SELECT location_id FROM l),
  '[DEMO] ' || base_title,
  base_desc,
  NULLIF(price_cents, 0),
  'active',
  now() - (n || ' hours')::interval
FROM src;

COMMIT;
