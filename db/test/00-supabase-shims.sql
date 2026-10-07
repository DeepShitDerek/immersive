-- TEST ONLY. Never run against a real Supabase project.
--
-- The supabase/postgres image ships the database, roles and extensions, but
-- two things the schema relies on are created by other Supabase services in
-- production: auth.jwt() (Auth/GoTrue migrations) and the storage tables
-- (Storage API migrations). These are minimal stand-ins with the same
-- signatures and semantics, so db/schema.sql can be loaded and its policies
-- exercised locally.

-- Matches current Supabase Auth: claims arrive as one JSON setting.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid() TO anon, authenticated;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  public     BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id  TEXT REFERENCES storage.buckets(id),
  name       TEXT,
  owner      UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA storage TO anon, authenticated;
GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated;
