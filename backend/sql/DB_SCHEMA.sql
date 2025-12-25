--
-- PostgreSQL database dump
--

\restrict s2dQUDfZcViZcUU1SgZHYlpsl8Qg7dJDGrXyMn6VuVKepAIZ6bMlAJm15f5b8PI

-- Dumped from database version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.11 (Ubuntu 16.11-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_replaced_by_ad_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_parent_ad_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_location_id_fkey;
ALTER TABLE IF EXISTS ONLY public.ad_photos DROP CONSTRAINT IF EXISTS ad_photos_ad_id_fkey;
DROP TRIGGER IF EXISTS trg_ads_no_update_non_draft ON public.ads;
DROP INDEX IF EXISTS public.uq_ads_replaced_by;
DROP INDEX IF EXISTS public.idx_ads_user_created_at;
DROP INDEX IF EXISTS public.idx_ads_status_created_at;
DROP INDEX IF EXISTS public.idx_ads_replaced_by_ad_id;
DROP INDEX IF EXISTS public.idx_ads_parent_ad_id;
DROP INDEX IF EXISTS public.idx_ads_location_active_published;
DROP INDEX IF EXISTS public.idx_ad_photos_ad_sort;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.locations DROP CONSTRAINT IF EXISTS locations_pkey;
ALTER TABLE IF EXISTS ONLY public.locations DROP CONSTRAINT IF EXISTS locations_country_city_district_key;
ALTER TABLE IF EXISTS ONLY public.ads DROP CONSTRAINT IF EXISTS ads_pkey;
ALTER TABLE IF EXISTS ONLY public.ad_photos DROP CONSTRAINT IF EXISTS ad_photos_pkey;
ALTER TABLE IF EXISTS ONLY public.ad_photos DROP CONSTRAINT IF EXISTS ad_photos_ad_id_sort_order_key;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.locations;
DROP TABLE IF EXISTS public.ads;
DROP TABLE IF EXISTS public.ad_photos;
DROP FUNCTION IF EXISTS public.ads_prevent_update_non_draft();
DROP TYPE IF EXISTS public.ad_status;
DROP EXTENSION IF EXISTS pgcrypto;
--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: ad_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ad_status AS ENUM (
    'draft',
    'active',
    'stopped'
);


--
-- Name: ads_prevent_update_non_draft(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ads_prevent_update_non_draft() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- ✅ allow "system" updates from app code (inside transaction)
  IF current_setting('app.allow_non_draft_update', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION
      'Only draft ads can be updated (ad_id=% , status=%). Use fork edit instead.',
      OLD.id, OLD.status
      USING ERRCODE = '45000';
  END IF;

  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ad_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ad_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    ad_id uuid NOT NULL,
    file_path text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ad_photos_sort_order_check CHECK ((sort_order >= 0))
);


--
-- Name: ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    location_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    price_cents integer,
    status public.ad_status DEFAULT 'draft'::public.ad_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    stopped_at timestamp with time zone,
    parent_ad_id uuid,
    replaced_by_ad_id uuid,
    CONSTRAINT ads_check CHECK ((((status = 'draft'::public.ad_status) AND (published_at IS NULL) AND (stopped_at IS NULL)) OR ((status = 'active'::public.ad_status) AND (published_at IS NOT NULL)) OR ((status = 'stopped'::public.ad_status) AND (stopped_at IS NOT NULL)))),
    CONSTRAINT ads_description_check CHECK (((length(description) >= 10) AND (length(description) <= 5000))),
    CONSTRAINT ads_price_cents_check CHECK (((price_cents IS NULL) OR (price_cents >= 0))),
    CONSTRAINT ads_title_check CHECK (((length(title) >= 3) AND (length(title) <= 120)))
);


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    country text NOT NULL,
    city text NOT NULL,
    district text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ad_photos ad_photos_ad_id_sort_order_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_photos
    ADD CONSTRAINT ad_photos_ad_id_sort_order_key UNIQUE (ad_id, sort_order);


--
-- Name: ad_photos ad_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_photos
    ADD CONSTRAINT ad_photos_pkey PRIMARY KEY (id);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: locations locations_country_city_district_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_country_city_district_key UNIQUE (country, city, district);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_ad_photos_ad_sort; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ad_photos_ad_sort ON public.ad_photos USING btree (ad_id, sort_order);


--
-- Name: idx_ads_location_active_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ads_location_active_published ON public.ads USING btree (location_id, published_at DESC) WHERE (status = 'active'::public.ad_status);


--
-- Name: idx_ads_parent_ad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ads_parent_ad_id ON public.ads USING btree (parent_ad_id);


--
-- Name: idx_ads_replaced_by_ad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ads_replaced_by_ad_id ON public.ads USING btree (replaced_by_ad_id);


--
-- Name: idx_ads_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ads_status_created_at ON public.ads USING btree (status, created_at DESC);


--
-- Name: idx_ads_user_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ads_user_created_at ON public.ads USING btree (user_id, created_at DESC);


--
-- Name: uq_ads_replaced_by; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_ads_replaced_by ON public.ads USING btree (replaced_by_ad_id) WHERE (replaced_by_ad_id IS NOT NULL);


--
-- Name: ads trg_ads_no_update_non_draft; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_ads_no_update_non_draft BEFORE UPDATE ON public.ads FOR EACH ROW EXECUTE FUNCTION public.ads_prevent_update_non_draft();


--
-- Name: ad_photos ad_photos_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ad_photos
    ADD CONSTRAINT ad_photos_ad_id_fkey FOREIGN KEY (ad_id) REFERENCES public.ads(id) ON DELETE CASCADE;


--
-- Name: ads ads_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE RESTRICT;


--
-- Name: ads ads_parent_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_parent_ad_id_fkey FOREIGN KEY (parent_ad_id) REFERENCES public.ads(id) ON DELETE SET NULL;


--
-- Name: ads ads_replaced_by_ad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_replaced_by_ad_id_fkey FOREIGN KEY (replaced_by_ad_id) REFERENCES public.ads(id) ON DELETE SET NULL;


--
-- Name: ads ads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict s2dQUDfZcViZcUU1SgZHYlpsl8Qg7dJDGrXyMn6VuVKepAIZ6bMlAJm15f5b8PI

