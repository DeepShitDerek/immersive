-- TEST ONLY. Blog post bookkeeping, checked against the real schema by
-- scripts/test-db.mjs. Runs after 30-restore.sql and reuses its harness.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

TRUNCATE t.results RESTART IDENTITY;

BEGIN;
SELECT t.act_as('owner');
INSERT INTO blog_posts (id, title, slug, content, published, published_at, updated_at)
VALUES ('50000000-0000-0000-0000-000000000001', 'Dated post', 'dated-post', 'Body', true, now(), '2026-01-01T00:00:00Z');
COMMIT;

BEGIN;
SELECT t.act_as('anon');
SELECT public.increment_blog_post_view('50000000-0000-0000-0000-000000000001');
COMMIT;

BEGIN;
SELECT t.act_as('owner');
SELECT t.check((SELECT views = 1 AND updated_at = '2026-01-01T00:00:00Z' FROM blog_posts WHERE id = '50000000-0000-0000-0000-000000000001'),
  'a view is counted without marking the post as edited');
UPDATE blog_posts SET content = 'Body, revised' WHERE id = '50000000-0000-0000-0000-000000000001';
SELECT t.check((SELECT updated_at > '2026-01-01T00:00:00Z' FROM blog_posts WHERE id = '50000000-0000-0000-0000-000000000001'),
  'an edit still moves updated_at');
-- Every column of blog_posts is either in the trigger's UPDATE OF list or
-- deliberately left out of it, so a column added later cannot be edited
-- without updated_at noticing.
SELECT t.check(NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.table_name = 'blog_posts'
     AND c.is_generated = 'NEVER'
     AND c.column_name NOT IN ('id', 'views', 'created_at', 'updated_at')
     AND c.column_name NOT IN (
       SELECT a.attname FROM pg_trigger tg
         JOIN pg_attribute a ON a.attrelid = tg.tgrelid AND a.attnum = ANY (tg.tgattr)
        WHERE tg.tgname = 'update_blog_posts_updated_at')
), 'every editable post column moves updated_at');
DELETE FROM blog_posts WHERE id = '50000000-0000-0000-0000-000000000001';
COMMIT;

SELECT CASE WHEN ok THEN 'ok     ' ELSE 'NOT OK ' END || n || ' - ' || name AS result
  FROM t.results ORDER BY n;

DO $$
DECLARE failed INT; total INT;
BEGIN
  SELECT count(*) FILTER (WHERE NOT ok), count(*) INTO failed, total FROM t.results;
  IF failed > 0 THEN
    RAISE EXCEPTION '% of % post checks failed', failed, total;
  END IF;
  RAISE WARNING 'all % post checks passed', total;
END $$;
