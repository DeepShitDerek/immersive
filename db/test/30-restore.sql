-- TEST ONLY. Restoring a workspace backup (restore_workspace), checked against
-- the real schema in a throwaway container by scripts/test-db.mjs. Runs after
-- 20-money.sql and reuses its harness (schema `t`) and owner account.

\set ON_ERROR_STOP on
SET client_min_messages = warning;

TRUNCATE t.results RESTART IDENTITY;

-- ── Order: parents before children, for every foreign key ──────────────────

SELECT t.check(NOT EXISTS (
  SELECT 1
    FROM pg_constraint c
    JOIN pg_class child ON child.oid = c.conrelid
    JOIN pg_class parent ON parent.oid = c.confrelid
   WHERE c.contype = 'f'
     AND child.relname <> parent.relname
     AND array_position(public.workspace_restore_tables(), child.relname::TEXT) IS NOT NULL
     AND array_position(public.workspace_restore_tables(), parent.relname::TEXT) IS NOT NULL
     AND array_position(public.workspace_restore_tables(), parent.relname::TEXT)
       > array_position(public.workspace_restore_tables(), child.relname::TEXT)
), 'every table is restored after the tables it references');

SELECT t.check(NOT EXISTS (
  SELECT 1
    FROM information_schema.columns c
   WHERE c.table_schema = 'public' AND c.column_name = 'user_id'
     AND c.table_name NOT IN ('analytics_secret', 'integration_settings', 'site_visits')
     AND c.table_name NOT IN (SELECT unnest(public.workspace_restore_tables()))
     AND c.table_name IN (SELECT table_name FROM information_schema.tables
                           WHERE table_schema = 'public' AND table_type = 'BASE TABLE')
), 'every owner table is restorable, apart from secrets and visitor analytics');

-- ── Fixtures, a backup of them, then the loss ───────────────────────────────

BEGIN;
SELECT t.act_as('owner');

INSERT INTO task_projects (id, name) VALUES ('40000000-0000-0000-0000-000000000001', 'Restore project');
INSERT INTO tasks (id, project_id, title) VALUES
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Restore task');
INSERT INTO sub_tasks (id, task_id, title) VALUES
  ('42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Restore subtask');
INSERT INTO notes (id, title, content) VALUES ('43000000-0000-0000-0000-000000000001', 'Restore note', 'Body');
INSERT INTO money_account (id, name, kind, currency, opening_date) VALUES
  ('44000000-0000-0000-0000-000000000001', 'Restore chequing', 'chequing', 'CAD', '2026-01-01');
INSERT INTO money_category (id, name, bucket) VALUES
  ('45000000-0000-0000-0000-000000000001', 'Restore parent', 'want');
INSERT INTO money_category (id, parent_id, name) VALUES
  ('45000000-0000-0000-0000-000000000002', '45000000-0000-0000-0000-000000000001', 'Restore child');
SELECT public.money_record_transaction(
  '{"date":"2026-03-01","kind":"expense","description":"Restore purchase"}',
  '[{"account_id":"44000000-0000-0000-0000-000000000001","category_id":"45000000-0000-0000-0000-000000000002","amount_minor":-2500}]');

CREATE TEMP TABLE backup AS
SELECT jsonb_build_object(
  'format', 'two.oooo-workspace',
  'version', 1,
  'tables', jsonb_build_object(
    'task_projects', (SELECT jsonb_agg(to_jsonb(p)) FROM task_projects p WHERE id = '40000000-0000-0000-0000-000000000001'),
    'tasks', (SELECT jsonb_agg(to_jsonb(x)) FROM tasks x WHERE id = '41000000-0000-0000-0000-000000000001'),
    'sub_tasks', (SELECT jsonb_agg(to_jsonb(x)) FROM sub_tasks x WHERE task_id = '41000000-0000-0000-0000-000000000001'),
    -- A note written under another account id: it comes back as the caller's.
    'notes', (SELECT jsonb_agg(to_jsonb(x) || '{"user_id":"00000000-0000-0000-0000-0000000000ff"}') FROM notes x WHERE id = '43000000-0000-0000-0000-000000000001'),
    'money_account', (SELECT jsonb_agg(to_jsonb(x)) FROM money_account x WHERE id = '44000000-0000-0000-0000-000000000001'),
    -- Child listed before its parent, as a JSON file may.
    'money_category', (SELECT jsonb_agg(to_jsonb(x) ORDER BY parent_id NULLS LAST) FROM money_category x WHERE id::TEXT LIKE '45000000%'),
    'money_transaction', (SELECT jsonb_agg(to_jsonb(x)) FROM money_transaction x WHERE description = 'Restore purchase'),
    'money_posting', (SELECT jsonb_agg(to_jsonb(p)) FROM money_posting p JOIN money_transaction x ON x.id = p.transaction_id WHERE x.description = 'Restore purchase')
  )
) AS doc;
GRANT SELECT ON backup TO authenticated;

DELETE FROM notes WHERE id = '43000000-0000-0000-0000-000000000001';
DELETE FROM tasks WHERE id = '41000000-0000-0000-0000-000000000001';
DELETE FROM task_projects WHERE id = '40000000-0000-0000-0000-000000000001';
DELETE FROM money_transaction WHERE description = 'Restore purchase';
DELETE FROM money_category WHERE id = '45000000-0000-0000-0000-000000000002';
DELETE FROM money_category WHERE id = '45000000-0000-0000-0000-000000000001';
DELETE FROM money_account WHERE id = '44000000-0000-0000-0000-000000000001';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

-- ── Restore ────────────────────────────────────────────────────────────────

CREATE TEMP TABLE first_run AS SELECT public.restore_workspace((SELECT doc FROM backup)) AS added;
GRANT SELECT ON first_run TO authenticated;
-- The ledger's deferred balance checks, now rather than at commit.
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

SELECT t.check((SELECT added = '{"tasks":1,"notes":1,"sub_tasks":1,"money_account":1,"task_projects":1,"money_posting":1,"money_category":2,"money_transaction":1}'::JSONB FROM first_run),
  'a restore reports what it added, table by table');
SELECT t.check((SELECT count(*) FROM sub_tasks s JOIN tasks x ON x.id = s.task_id JOIN task_projects p ON p.id = x.project_id
                 WHERE p.id = '40000000-0000-0000-0000-000000000001') = 1,
  'projects, tasks and subtasks come back linked');
SELECT t.check((SELECT sum(p.amount_minor) FROM money_posting p JOIN money_transaction x ON x.id = p.transaction_id
                 WHERE x.description = 'Restore purchase') = -2500,
  'a ledger transaction comes back with its postings, balanced');
SELECT t.check((SELECT parent_id = '45000000-0000-0000-0000-000000000001' FROM money_category WHERE id = '45000000-0000-0000-0000-000000000002'),
  'a subcategory restores even when listed before its parent');
SELECT t.check((SELECT user_id = '00000000-0000-0000-0000-00000000000a' FROM notes WHERE id = '43000000-0000-0000-0000-000000000001'),
  'restored rows belong to whoever restores them');

SELECT t.check((SELECT NOT EXISTS (SELECT 1 FROM jsonb_each_text(public.restore_workspace((SELECT doc FROM backup))) WHERE value <> '0')),
  'restoring the same backup again adds nothing');

UPDATE notes SET title = 'Edited since' WHERE id = '43000000-0000-0000-0000-000000000001';
SELECT public.restore_workspace((SELECT doc FROM backup));
SELECT t.check((SELECT title FROM notes WHERE id = '43000000-0000-0000-0000-000000000001') = 'Edited since',
  'a restore never overwrites a row that exists');

SELECT t.refuses($q$SELECT public.restore_workspace('{"format":"something-else","version":1,"tables":{}}')$q$,
  'a file that is not a workspace backup is refused', 'not a workspace backup');
COMMIT;

BEGIN;
SELECT t.act_as('owner_aal1');
SELECT t.refuses($q$SELECT public.restore_workspace('{"format":"two.oooo-workspace","version":1,"tables":{}}')$q$,
  'a password-only session cannot restore', 'Not authorised');
COMMIT;

BEGIN;
SELECT t.act_as('anon');
SELECT t.refuses($q$SELECT public.restore_workspace('{"format":"two.oooo-workspace","version":1,"tables":{}}')$q$,
  'anon cannot restore', 'permission denied');
COMMIT;

SELECT CASE WHEN ok THEN 'ok     ' ELSE 'NOT OK ' END || n || ' - ' || name AS result
  FROM t.results ORDER BY n;

DO $$
DECLARE failed INT; total INT;
BEGIN
  SELECT count(*) FILTER (WHERE NOT ok), count(*) INTO failed, total FROM t.results;
  IF failed > 0 THEN
    RAISE EXCEPTION '% of % restore checks failed', failed, total;
  END IF;
  RAISE WARNING 'all % restore checks passed', total;
END $$;
