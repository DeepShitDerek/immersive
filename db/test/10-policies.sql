-- TEST ONLY. Behavioural checks of row-level security and the RPCs, run
-- against a throwaway supabase/postgres container by scripts/test-db.mjs.
--
-- Each check switches to the role PostgREST would use (anon / authenticated)
-- with the JWT claims it would set, then asserts what that caller can and
-- cannot do. db/schema.sql is the thing under test; nothing here changes it.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

-- ── Harness ─────────────────────────────────────────────────────────────────

DROP SCHEMA IF EXISTS t CASCADE;
CREATE SCHEMA t;
GRANT USAGE ON SCHEMA t TO anon, authenticated;

CREATE TABLE t.results (n SERIAL, ok BOOLEAN, name TEXT);
GRANT ALL ON t.results TO anon, authenticated;
GRANT USAGE ON SEQUENCE t.results_n_seq TO anon, authenticated;

CREATE FUNCTION t.check(cond BOOLEAN, name TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO t.results (ok, name) VALUES (coalesce(cond, false), name);
END $$;

-- Runs `statement`; passes when it raises an error whose message contains
-- `expected` (any error when expected is NULL).
CREATE FUNCTION t.refuses(statement TEXT, name TEXT, expected TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    PERFORM t.check(expected IS NULL OR SQLERRM ILIKE '%' || expected || '%',
                    name || CASE WHEN expected IS NULL THEN '' ELSE ' [' || SQLERRM || ']' END);
    RETURN;
  END;
  PERFORM t.check(false, name || ' [statement succeeded]');
END $$;

-- Rows `statement` affects/returns, or -1 when it errors.
CREATE FUNCTION t.count_of(statement TEXT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  EXECUTE 'SELECT count(*) FROM (' || statement || ') q' INTO n;
  RETURN n;
EXCEPTION WHEN OTHERS THEN
  RETURN -1;
END $$;

-- Rows a write statement actually changed (RLS hides rows rather than
-- raising), or -1 when it errors.
CREATE FUNCTION t.affected(statement TEXT) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE n INT;
BEGIN
  EXECUTE statement;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
EXCEPTION WHEN OTHERS THEN
  RETURN -1;
END $$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA t TO anon, authenticated;

-- PostgREST's view of a caller: a role plus JWT claims for this transaction.
CREATE FUNCTION t.act_as(who TEXT) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF who = 'anon' THEN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    EXECUTE 'SET LOCAL ROLE anon';
  ELSIF who = 'owner_aal1' THEN
    PERFORM set_config('request.jwt.claims',
      '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal1"}', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  ELSIF who = 'owner' THEN
    PERFORM set_config('request.jwt.claims',
      '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a","aal":"aal2"}', true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  ELSE
    RAISE EXCEPTION 'unknown actor %', who;
  END IF;
END $$;

-- ── Re-running the schema seeds nothing twice ───────────────────────────────
-- The runner has applied db/schema.sql twice by now; re-running it is how an
-- existing project picks up changes, so every seed has to be idempotent.

SELECT t.check((SELECT count(*) FROM navigation_links) = 4,
  'default nav is seeded once, not once per schema run');
SELECT t.check((SELECT count(*) FROM site_identity) = 1
           AND (SELECT count(*) FROM security_settings) = 1
           AND (SELECT count(*) FROM integration_settings) = 1,
  'single-row settings tables stay single-row');

-- ── Fixtures (as table owner, which bypasses RLS) ───────────────────────────

INSERT INTO portfolio_sections (id, user_id, title, type, page_path, is_visible) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'Visible', 'list_items', '/t', true),
  ('10000000-0000-0000-0000-000000000002', NULL, 'Hidden',  'list_items', '/t', false);
INSERT INTO portfolio_items (section_id, user_id, title, internal_notes, slug, case_study) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL, 'public item', 'secret-a', 't-case', '# Story'),
  ('10000000-0000-0000-0000-000000000002', NULL, 'hidden item', 'secret-b', 't-hidden-case', '# Hidden');
INSERT INTO blog_posts (user_id, title, slug, content, published, internal_notes) VALUES
  (NULL, 'Published', 't-published', 'one two three', true,  'secret-c'),
  (NULL, 'Draft',     't-draft',     'draft body',    false, 'secret-d');

-- ── Visitors ────────────────────────────────────────────────────────────────

BEGIN;
SELECT t.act_as('anon');
SELECT t.refuses('SELECT internal_notes FROM blog_posts',
  'anon cannot read blog_posts.internal_notes', 'permission denied');
SELECT t.refuses('SELECT internal_notes FROM portfolio_items',
  'anon cannot read portfolio_items.internal_notes', 'permission denied');
SELECT t.refuses('SELECT * FROM blog_posts',
  'anon SELECT * is refused rather than silently leaking', 'permission denied');
SELECT t.check(t.count_of($q$SELECT id, title, slug, content, word_count FROM blog_posts WHERE slug LIKE 't-%'$q$) = 1,
  'anon sees the published post only, with every public column');
SELECT t.check(t.count_of($q$SELECT id, title FROM portfolio_items WHERE title IN ('public item','hidden item')$q$) = 1,
  'anon sees items of visible sections only');
SELECT t.check(t.count_of($q$SELECT s.id FROM portfolio_sections s WHERE page_path = '/t'$q$) = 1,
  'anon sees visible sections only');
SELECT t.check(t.count_of($q$SELECT slug, case_study FROM portfolio_items WHERE has_case_study$q$) = 1,
  'anon reads case studies of visible sections only');
SELECT t.check(t.count_of('SELECT * FROM integration_settings') = 0, 'anon cannot read integration secrets');
SELECT t.check(t.count_of('SELECT * FROM analytics_secret') <= 0, 'anon cannot read the analytics secret');
SELECT t.refuses($q$INSERT INTO tasks (title) VALUES ('x')$q$, 'anon cannot write workspace tables');
SELECT t.check(t.affected($q$UPDATE blog_posts SET title = 'pwned' WHERE slug = 't-published'$q$) = 0,
  'anon cannot edit posts');
COMMIT;

BEGIN;
SELECT t.act_as('anon');
SELECT t.refuses($q$SELECT public.get_visitor_analytics(30, false)$q$, 'anon cannot run admin analytics');
SELECT t.refuses($q$SELECT public.money_record_transaction('{}'::jsonb, '[]'::jsonb)$q$, 'anon cannot call finance RPCs');
COMMIT;

-- Contact form: accepted, then rate-limited per address.
BEGIN;
SELECT t.act_as('anon');
INSERT INTO contact_submissions (name, email, subject, message)
SELECT 'Visitor', 'rate@example.com', 'Hello there', 'A message long enough.' FROM generate_series(1, 3);
SELECT t.refuses($q$INSERT INTO contact_submissions (name, email, subject, message) VALUES ('Visitor','rate@example.com','Hello there','A message long enough.')$q$,
  'a fourth message from one address in an hour is refused', 'Too many messages');
SELECT t.refuses($q$INSERT INTO contact_submissions (name, email, subject, message) VALUES ('V','x@example.com','Hello there','A message long enough.')$q$,
  'contact length CHECK is enforced by the database', 'contact_submissions_length_check');
SELECT t.check(t.affected($q$INSERT INTO contact_submissions (name, email, subject, message, topic) VALUES ('Recruiter','topic@example.com','A role for you','We are hiring an AI engineer.','role')$q$) = 1,
  'a visitor can say what the message is about');
SELECT t.refuses($q$INSERT INTO contact_submissions (name, email, subject, message, topic) VALUES ('Visitor','topic2@example.com','Hello there','A message long enough.','spam')$q$,
  'an unknown topic is refused by the database', 'contact_submissions_topic_check');
SELECT t.check(t.affected($q$INSERT INTO contact_submissions (name, email, subject, message) VALUES ('Old form','topic3@example.com','Hello there','Sent by the form before topics.')$q$) = 1,
  'a message without a topic is still accepted');
COMMIT;

-- ── Password-only session (AAL1) ────────────────────────────────────────────

INSERT INTO auth.users (id, email, created_at)
VALUES ('00000000-0000-0000-0000-00000000000a', 'owner@example.com', now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

BEGIN;
SELECT t.act_as('owner_aal1');
SELECT t.refuses($q$INSERT INTO tasks (title) VALUES ('aal1 task')$q$,
  'a password-only session cannot write, even as the owner');
SELECT t.check(t.count_of('SELECT id FROM tasks') = 0, 'a password-only session reads no private rows');
SELECT t.refuses($q$SELECT * FROM public.get_calendar_data(current_date, current_date)$q$,
  'definer RPCs refuse a password-only session', 'Not authorised');
SELECT t.check(t.count_of('SELECT internal_notes FROM blog_posts') = 1,
  'AAL1 sees published rows only via the public policy');
COMMIT;

-- ── Owner with second factor (AAL2) ─────────────────────────────────────────

BEGIN;
SELECT t.act_as('owner');
INSERT INTO tasks (title) VALUES ('owner task'), ('update me'), ('delete me');
SELECT t.check(t.count_of($q$SELECT id FROM tasks WHERE title = 'owner task'$q$) = 1, 'the verified owner can write and read tasks');
SELECT t.check(t.count_of($q$SELECT internal_notes FROM blog_posts WHERE slug LIKE 't-%'$q$) = 2,
  'the verified owner reads drafts and internal notes');
SELECT t.check(t.count_of($q$SELECT id FROM portfolio_items WHERE title = 'hidden item'$q$) = 1,
  'the verified owner still sees items of hidden sections');
COMMIT;

-- ── Maps ───────────────────────────────────────────────────────────

BEGIN;
SELECT t.act_as('owner');
INSERT INTO thinking_maps (id, name, doc, node_count)
VALUES ('20000000-0000-0000-0000-000000000001', 'Life map',
        '{"schemaVersion":1,"nodes":[],"edges":[]}', 0);
SELECT t.check(t.count_of($q$SELECT id FROM thinking_maps$q$) = 1,
  'maps: the verified owner creates and reads a map');
-- The app's save: bump the revision only if nobody else has.
SELECT t.check(t.affected($q$UPDATE thinking_maps SET name = 'v1', revision = revision + 1 WHERE id = '20000000-0000-0000-0000-000000000001' AND revision = 0$q$) = 1,
  'maps: a save against the current revision succeeds');
SELECT t.check(t.affected($q$UPDATE thinking_maps SET name = 'stale', revision = revision + 1 WHERE id = '20000000-0000-0000-0000-000000000001' AND revision = 0$q$) = 0,
  'maps: a save against a stale revision changes nothing (other tab wins)');
SELECT t.refuses($q$UPDATE thinking_maps SET doc = jsonb_build_object('pad', repeat('x', 5000001)) WHERE id = '20000000-0000-0000-0000-000000000001'$q$,
  'maps: documents over ~5 MB are refused', 'thinking_maps_doc_size');
COMMIT;

BEGIN;
SELECT t.act_as('owner_aal1');
SELECT t.check(t.count_of('SELECT id FROM thinking_maps') = 0,
  'maps: a password-only session sees no maps');
SELECT t.refuses($q$INSERT INTO thinking_maps (name) VALUES ('aal1')$q$,
  'maps: a password-only session cannot create one');
COMMIT;

BEGIN;
SELECT t.act_as('anon');
SELECT t.check(t.count_of('SELECT id FROM thinking_maps') <= 0,
  'maps: visitors see no maps');
COMMIT;

-- ── Lockdown level 2 ───────────────────────────────────────────────

BEGIN;
SELECT t.act_as('owner');
UPDATE security_settings SET lockdown_level = 2 WHERE id = 1;
COMMIT;

BEGIN;
SELECT t.act_as('owner');
SELECT t.refuses($q$INSERT INTO tasks (title) VALUES ('during lockdown')$q$,
  'lockdown: owner inserts are refused', 'row-level security');
-- Each write targets its own row, so one check succeeding by mistake cannot
-- make the next one pass by leaving nothing to act on.
SELECT t.check(t.affected($q$UPDATE tasks SET title = 'renamed' WHERE title = 'update me'$q$) = 0,
  'lockdown: owner updates change nothing');
SELECT t.check(t.affected($q$DELETE FROM tasks WHERE title = 'delete me'$q$) = 0,
  'lockdown: owner deletes change nothing');
SELECT t.check(t.count_of($q$SELECT id FROM tasks WHERE title = 'owner task'$q$) = 1,
  'lockdown: reads still work');
SELECT t.check(t.affected($q$UPDATE thinking_maps SET name = 'locked?' WHERE id = '20000000-0000-0000-0000-000000000001'$q$) = 0,
  'lockdown: map saves change nothing');
SELECT t.refuses($q$SELECT public.money_record_transaction('{}'::jsonb, '[]'::jsonb)$q$,
  'lockdown: definer write RPCs refuse too', 'locked');
SELECT t.refuses($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('assets', 'x.png')$q$,
  'lockdown: asset uploads are refused', 'row-level security');
COMMIT;

BEGIN;
SELECT t.act_as('anon');
INSERT INTO contact_submissions (name, email, subject, message)
VALUES ('Visitor', 'locked@example.com', 'Hello there', 'Still reachable in lockdown.');
SELECT t.check(true, 'lockdown: visitors can still send a message');
COMMIT;

BEGIN;
SELECT t.act_as('owner');
UPDATE security_settings SET lockdown_level = 0 WHERE id = 1;
SELECT t.check((SELECT lockdown_level FROM security_settings WHERE id = 1) = 0,
  'lockdown can always be lowered by the owner');
SELECT t.check(t.affected($q$UPDATE tasks SET title = 'renamed' WHERE title = 'update me'$q$) = 1,
  'control: the same update affects 1 row when unlocked');
SELECT t.check(t.affected($q$DELETE FROM tasks WHERE title = 'delete me'$q$) = 1,
  'control: the same delete affects 1 row when unlocked');
SELECT t.check(t.affected($q$INSERT INTO tasks (title) VALUES ('after lockdown')$q$) = 1,
  'writes work again after lowering the level');
COMMIT;

-- ── Visits: daily ceiling ──────────────────────────────────────────

-- 20,000 visits spread over the last 23 hours, never more than a handful in
-- any minute, half of them bots: only the daily ceiling can drop the next one.
-- (The enrichment trigger would reset created_at to now(), so it is off too.)
ALTER TABLE site_visits DISABLE TRIGGER enrich_site_visit;
ALTER TABLE site_visits DISABLE TRIGGER limit_site_visits;
ALTER TABLE site_visits DISABLE TRIGGER notify_site_visit;
INSERT INTO site_visits (path, is_bot, created_at)
SELECT '/', (g % 2 = 0), now() - interval '5 minutes' - (g * interval '4 seconds')
  FROM generate_series(1, 20000) g;
ALTER TABLE site_visits ENABLE TRIGGER enrich_site_visit;
ALTER TABLE site_visits ENABLE TRIGGER limit_site_visits;
ALTER TABLE site_visits ENABLE TRIGGER notify_site_visit;

BEGIN;
SELECT t.act_as('anon');
INSERT INTO site_visits (path) VALUES ('/after-ceiling');
COMMIT;
SELECT t.check((SELECT count(*) FROM site_visits WHERE path = '/after-ceiling') = 0,
  'visits past the daily ceiling are dropped, bots counted');
DELETE FROM site_visits;

BEGIN;
SELECT t.act_as('anon');
INSERT INTO site_visits (path) VALUES ('/ok');
COMMIT;
SELECT t.check((SELECT count(*) FROM site_visits WHERE path = '/ok') = 1,
  'a normal visit is recorded');

-- ── Case-study slugs ────────────────────────────────────────────────

SELECT t.refuses($q$UPDATE portfolio_items SET slug = 'Bad Slug' WHERE title = 'public item'$q$,
  'case-study slug must be lower-case kebab', 'portfolio_items_slug_check');
SELECT t.refuses($q$UPDATE portfolio_items SET slug = 'view' WHERE title = 'public item'$q$,
  'case-study slug cannot shadow /work/view/', 'portfolio_items_slug_check');
SELECT t.refuses($q$UPDATE portfolio_items SET slug = 't-hidden-case' WHERE title = 'public item'$q$,
  'case-study slugs are unique', 'portfolio_items_slug_key');
UPDATE portfolio_items SET case_study = '   ' WHERE title = 'public item';
SELECT t.check(NOT (SELECT has_case_study FROM portfolio_items WHERE title = 'public item'),
  'a blank case-study body publishes no page');
UPDATE portfolio_items SET case_study = '# Story' WHERE title = 'public item';

-- ── One account only ────────────────────────────────────────────────────────

SELECT t.refuses($q$INSERT INTO auth.users (id, email) VALUES (gen_random_uuid(), 'second@example.com')$q$,
  'a second account can never be created', 'Signups are disabled');

-- ── Report ──────────────────────────────────────────────────────────────────

SELECT CASE WHEN ok THEN 'ok     ' ELSE 'NOT OK ' END || n || ' - ' || name AS result
  FROM t.results ORDER BY n;

DO $$
DECLARE failed INT; total INT;
BEGIN
  SELECT count(*) FILTER (WHERE NOT ok), count(*) INTO failed, total FROM t.results;
  IF failed > 0 THEN
    RAISE EXCEPTION '% of % database checks failed', failed, total;
  END IF;
  RAISE WARNING 'all % database checks passed', total;
END $$;
