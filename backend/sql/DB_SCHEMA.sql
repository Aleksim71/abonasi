-- DB_SCHEMA.sql — Abonasi (MVP)
-- PostgreSQL schema: users, locations, ads, ad_photos
-- Status flow: draft -> active -> stopped

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_status') THEN
    CREATE TYPE ad_status AS ENUM ('draft', 'active', 'stopped');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country    text NOT NULL,
  city       text NOT NULL,
  district   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(country, city, district)
);

CREATE TABLE IF NOT EXISTS ads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id  uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,

  title        text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description  text NOT NULL CHECK (length(description) BETWEEN 10 AND 5000),

  -- Price in cents to avoid float issues; nullable for free/negotiable
  price_cents  integer NULL CHECK (price_cents IS NULL OR price_cents >= 0),

  status       ad_status NOT NULL DEFAULT 'draft',

  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  stopped_at   timestamptz NULL,

  CHECK (
    (status = 'draft' AND published_at IS NULL AND stopped_at IS NULL) OR
    (status = 'active' AND published_at IS NOT NULL) OR
    (status = 'stopped' AND stopped_at IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS ad_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id       uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  file_path   text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ad_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_ads_user_created_at
  ON ads (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ads_location_active_published
  ON ads (location_id, published_at DESC)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_ads_status_created_at
  ON ads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_photos_ad_sort
  ON ad_photos (ad_id, sort_order);

COMMIT;
