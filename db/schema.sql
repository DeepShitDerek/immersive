-- db/schema.sql
--
-- Full database schema for the Personal Portfolio + Admin OS.
-- This script is IDEMPOTENT — safe to run multiple times.
-- Run this in the Supabase SQL Editor to set up or reset your database.

-- =========================================================
-- 1. HELPER FUNCTIONS
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if any admin user has been created (used on the signup page).
CREATE OR REPLACE FUNCTION check_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  user_count int;
BEGIN
  SELECT count(*) INTO user_count FROM auth.users;
  RETURN user_count > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION check_admin_exists() TO anon;
GRANT EXECUTE ON FUNCTION check_admin_exists() TO authenticated;

-- True when the current session has completed MFA/TOTP verification (AAL2).
-- Admin-write policies require this so a password-only (AAL1) session can
-- never write data, even when calling PostgREST directly.
CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt()->>'aal', '') = 'aal2';
$$;
GRANT EXECUTE ON FUNCTION public.is_aal2() TO anon, authenticated;

-- True when the current session belongs to the admin — defined as the FIRST
-- registered user — and has completed MFA. Shared-content tables (site
-- identity, blog, portfolio, navigation) use this instead of the old
-- "any authenticated user" predicate so that a stray extra account can
-- never modify public content.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_aal2()
    AND auth.uid() = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1);
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- Server-side signup guard: only the first account can ever be created.
-- The signup page's check_admin_exists() gate is client-side UX only;
-- this trigger is the actual enforcement against direct auth API calls.
CREATE OR REPLACE FUNCTION public.block_additional_signups()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (SELECT count(*) FROM auth.users) > 0 THEN
    RAISE EXCEPTION 'Signups are disabled: an admin account already exists.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS block_additional_signups ON auth.users;
CREATE TRIGGER block_additional_signups
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.block_additional_signups();


-- =========================================================
-- 2. CUSTOM ENUM TYPES (idempotent)
-- =========================================================

DO $$ BEGIN CREATE TYPE task_status AS ENUM ('todo', 'inprogress', 'review', 'done'); EXCEPTION WHEN duplicate_object THEN null; END $$;
-- 'blocked' is deliberately absent: it is derived from unmet dependencies, so a
-- stored value could disagree with the dependency graph.
DO $$ BEGIN CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE learning_status AS ENUM ('To Learn', 'Learning', 'Practicing', 'Mastered'); EXCEPTION WHEN duplicate_object THEN null; END $$;


-- =========================================================
-- 3. SITE CONFIGURATION & IDENTITY
-- =========================================================

-- Single-row table for global site identity.
-- Writes use is_admin() (not user_id ownership) because the seed row has no
-- user_id (inserted from SQL editor).
CREATE TABLE IF NOT EXISTS site_identity (
  id INT PRIMARY KEY DEFAULT 1,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data JSONB,
  social_links JSONB,
  footer_data JSONB,
  portfolio_mode TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row_enforcement CHECK (id = 1)
);
ALTER TABLE site_identity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read site identity" ON site_identity;
CREATE POLICY "Public read site identity" ON site_identity FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage site identity" ON site_identity;
CREATE POLICY "Admin manage site identity" ON site_identity FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS update_site_identity_updated_at ON site_identity;
CREATE TRIGGER update_site_identity_updated_at BEFORE UPDATE ON site_identity FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Navigation Links
CREATE TABLE IF NOT EXISTS navigation_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  display_order INT4 DEFAULT 0,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE navigation_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read visible navigation" ON navigation_links;
CREATE POLICY "Public read visible navigation" ON navigation_links FOR SELECT USING (is_visible = true);
DROP POLICY IF EXISTS "Admin manage navigation" ON navigation_links;
CREATE POLICY "Admin manage navigation" ON navigation_links FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Security Settings (single-row, lockdown/kill-switch)
CREATE TABLE IF NOT EXISTS security_settings (
  id INT PRIMARY KEY DEFAULT 1,
  lockdown_level INT DEFAULT 0 CHECK (lockdown_level BETWEEN 0 AND 3),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT single_row_check CHECK (id = 1)
);
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read security" ON security_settings;
CREATE POLICY "Public read security" ON security_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manage security" ON security_settings;
CREATE POLICY "Admin manage security" ON security_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- =========================================================
-- 4. CONTENT TABLES (Portfolio, Blog)
-- =========================================================

-- Portfolio Sections
CREATE TABLE IF NOT EXISTS portfolio_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('markdown', 'list_items', 'gallery')),
  content TEXT,
  display_order INT4 DEFAULT 0,
  page_path TEXT NOT NULL DEFAULT '/',
  layout_style TEXT NOT NULL DEFAULT 'default',
  is_visible BOOLEAN DEFAULT true,
  -- Hidden titles stay in the markup, screen-reader-only.
  show_title BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE portfolio_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read sections" ON portfolio_sections;
CREATE POLICY "Public read sections" ON portfolio_sections FOR SELECT USING (is_visible = true);
DROP POLICY IF EXISTS "Admin manage sections" ON portfolio_sections;
CREATE POLICY "Admin manage sections" ON portfolio_sections FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS update_portfolio_sections_updated_at ON portfolio_sections;
CREATE TRIGGER update_portfolio_sections_updated_at BEFORE UPDATE ON portfolio_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Portfolio Items
CREATE TABLE IF NOT EXISTS portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES portfolio_sections(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  date_from TEXT,
  date_to TEXT,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  tags TEXT[],
  internal_notes TEXT,
  display_order INT4 DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
-- A branch that fed into another item. Derived concurrency is honest, but a
-- *merge* is a relationship between two items and needs saying explicitly —
-- inferring it from adjacency would draw a claim nobody made.
ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS merged_into_id UUID
    REFERENCES portfolio_items(id) ON DELETE SET NULL;

-- ON DELETE SET NULL, not CASCADE: deleting the thing a branch merged into
-- must not delete the branch. The relationship goes; the history stays.

CREATE INDEX IF NOT EXISTS portfolio_items_merged_into_idx
  ON portfolio_items(merged_into_id)
  WHERE merged_into_id IS NOT NULL;

-- Case studies: an item with a slug and a markdown body gets its own
-- page at /work/<slug>/. `has_case_study` lets list views know without
-- downloading every body. 'view' is taken by the /work/view/ fallback route.
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE portfolio_items ADD COLUMN IF NOT EXISTS case_study TEXT;
ALTER TABLE portfolio_items
  ADD COLUMN IF NOT EXISTS has_case_study BOOLEAN
    GENERATED ALWAYS AS (
      slug IS NOT NULL AND case_study IS NOT NULL AND btrim(case_study) <> ''
    ) STORED;
ALTER TABLE portfolio_items DROP CONSTRAINT IF EXISTS portfolio_items_slug_check;
ALTER TABLE portfolio_items ADD CONSTRAINT portfolio_items_slug_check CHECK (
  slug IS NULL OR (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80 AND slug <> 'view'
  )
);
ALTER TABLE portfolio_items DROP CONSTRAINT IF EXISTS portfolio_items_case_study_check;
ALTER TABLE portfolio_items ADD CONSTRAINT portfolio_items_case_study_check
  CHECK (case_study IS NULL OR char_length(case_study) <= 200000);
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_items_slug_key
  ON portfolio_items(slug) WHERE slug IS NOT NULL;

-- ----------------------------------------------------------------------------
-- A merge chain must not loop
-- ----------------------------------------------------------------------------
--
-- A → B → A is expressible and meaningless, and it would make any renderer
-- that walks the chain hang. Enforced in the database rather than the client,
-- the same way task dependencies are: the client can only prevent the cycles
-- it thinks of, and there is more than one way to write this row.
--
-- Not a CHECK constraint — Postgres forbids subqueries in those, which is a
-- trap this schema has already paid for once.
CREATE OR REPLACE FUNCTION public.reject_merge_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  cursor_id UUID := NEW.merged_into_id;
  hops INT := 0;
BEGIN
  IF NEW.merged_into_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.merged_into_id = NEW.id THEN
    RAISE EXCEPTION 'An item cannot merge into itself';
  END IF;

  -- Walk to the end of the chain. The hop bound is belt and braces: the walk
  -- terminates on its own for any acyclic chain, and a cycle already present
  -- from before this trigger existed would otherwise spin here forever.
  WHILE cursor_id IS NOT NULL AND hops < 64 LOOP
    IF cursor_id = NEW.id THEN
      RAISE EXCEPTION 'That merge would form a loop';
    END IF;

    SELECT merged_into_id INTO cursor_id
      FROM portfolio_items WHERE id = cursor_id;

    hops := hops + 1;
  END LOOP;

  IF hops >= 64 THEN
    RAISE EXCEPTION 'Merge chain is too deep to verify';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_portfolio_merge_cycle ON portfolio_items;
CREATE TRIGGER reject_portfolio_merge_cycle
  BEFORE INSERT OR UPDATE OF merged_into_id ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.reject_merge_cycle();

-- An item is public only while its section is. This was USING (true),
-- so hiding a section hid it from the site but not from anyone querying the
-- table. The admin policy below is OR'ed with this one, so the owner still
-- reads every item.
DROP POLICY IF EXISTS "Public read items" ON portfolio_items;
CREATE POLICY "Public read items" ON portfolio_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM portfolio_sections s
     WHERE s.id = portfolio_items.section_id
       AND s.is_visible = true
  )
);
DROP POLICY IF EXISTS "Admin manage items" ON portfolio_items;
CREATE POLICY "Admin manage items" ON portfolio_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS update_portfolio_items_updated_at ON portfolio_items;
CREATE TRIGGER update_portfolio_items_updated_at BEFORE UPDATE ON portfolio_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Blog Posts
CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT,
  cover_image_url TEXT,
  published BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ,
  show_toc BOOLEAN DEFAULT true,
  tags TEXT[],
  views BIGINT DEFAULT 0,
  internal_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Denormalized word count (kept by Postgres) so list views can compute read
-- time without fetching full post bodies.
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS word_count INT
  GENERATED ALWAYS AS (
    COALESCE(array_length(regexp_split_to_array(trim(content), '\s+'), 1), 0)
  ) STORED;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read posts" ON blog_posts;
CREATE POLICY "Public read posts" ON blog_posts FOR SELECT USING (published = true);
DROP POLICY IF EXISTS "Admin manage posts" ON blog_posts;
CREATE POLICY "Admin manage posts" ON blog_posts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON blog_posts;
-- Only when the post itself changes. A read (increment_blog_post_view bumps
-- `views`) used to stamp updated_at too, so every view marked the post as
-- edited: its link preview's modifiedTime moved with each reader, and the
-- site could not tell a prerendered post from a changed one.
-- Every column but views and the timestamps; a new column belongs here too
-- (db/test/40-posts.sql fails when one is missing).
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE OF user_id, title, slug, excerpt, content, cover_image_url,
    published, published_at, show_toc, tags, internal_notes
  ON blog_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Public columns. Row-level security chooses rows, not columns: a
-- published post's `internal_notes` was readable by anyone holding the anon
-- key, which ships in the site bundle. A column-level REVOKE does nothing while
-- the table-level grant exists, so anon's SELECT is replaced by an explicit
-- list. The owner signs in as `authenticated` and keeps the whole table.
--
-- A new column on either table is invisible to visitors until it is added
-- here AND to src/store/api/public-columns.ts; a test compares the two.
REVOKE SELECT ON public.blog_posts FROM anon;
GRANT SELECT (
  id, user_id, title, slug, excerpt, content, cover_image_url, published,
  published_at, show_toc, tags, views, word_count, created_at, updated_at
) ON public.blog_posts TO anon;

REVOKE SELECT ON public.portfolio_items FROM anon;
GRANT SELECT (
  id, section_id, user_id, title, subtitle, date_from, date_to, description,
  image_url, link_url, tags, display_order, merged_into_id, created_at,
  updated_at, slug, case_study, has_case_study
) ON public.portfolio_items TO anon;


-- =========================================================
-- 5. ADMIN TOOLS — Tasks, Notes, Events
-- =========================================================

CREATE TABLE IF NOT EXISTS task_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0 AND length(name) <= 120),
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  display_order INT4 DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE task_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage task projects" ON task_projects;
CREATE POLICY "Admin manage task projects" ON task_projects FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_task_projects_updated_at ON task_projects;
CREATE TRIGGER update_task_projects_updated_at BEFORE UPDATE ON task_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  project_id UUID REFERENCES task_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'medium',
  start_date DATE,
  due_date DATE,
  tags TEXT[],
  display_order INT4 DEFAULT 0,
  estimate_minutes INT4,
  tracked_minutes INT4 DEFAULT 0,
  completed_at TIMESTAMPTZ,
  recurrence TEXT,
  recurrence_interval INT4,
  recurrence_parent_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT tasks_dates_ordered CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date),
  CONSTRAINT tasks_estimate_nonneg CHECK (estimate_minutes IS NULL OR (estimate_minutes >= 0 AND estimate_minutes <= 100000)),
  CONSTRAINT tasks_tracked_nonneg CHECK (tracked_minutes IS NULL OR (tracked_minutes >= 0 AND tracked_minutes <= 100000)),
  CONSTRAINT tasks_recurrence_valid CHECK (recurrence IS NULL OR recurrence IN ('daily', 'weekly', 'monthly')),
  CONSTRAINT tasks_recurrence_interval_valid CHECK (recurrence_interval IS NULL OR (recurrence_interval >= 1 AND recurrence_interval <= 365)),
  CONSTRAINT tasks_recurrence_needs_due_date CHECK (recurrence IS NULL OR due_date IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage tasks" ON tasks;
CREATE POLICY "Admin manage tasks" ON tasks FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS sub_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE sub_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage subtasks" ON sub_tasks;
CREATE POLICY "Admin manage subtasks" ON sub_tasks FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());

-- `task_id` is blocked by `depends_on_id`.
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (task_id, depends_on_id),
  CHECK (task_id <> depends_on_id)
);
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage task dependencies" ON task_dependencies;
CREATE POLICY "Admin manage task dependencies" ON task_dependencies FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
CREATE INDEX IF NOT EXISTS task_dependencies_task_id_idx ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS task_dependencies_depends_on_id_idx ON task_dependencies(depends_on_id);

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT CHECK (title IS NULL OR length(title) <= 200),
  -- Markdown. `[[wikilinks]]` inside it are resolved in the client from the
  -- notes already loaded, so the link graph cannot fall out of step with the
  -- text that defines it and there is no join table to keep in sync.
  content TEXT CHECK (content IS NULL OR length(content) <= 100000),
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  tags TEXT[],
  is_pinned BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notes_archived_at_idx ON notes(archived_at);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes(updated_at DESC);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage notes" ON notes;
CREATE POLICY "Admin manage notes" ON notes FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
-- `updated_at` on a note means "the content changed", so filing a note —
-- pinning it, reordering it — deliberately leaves the timestamp alone. Written as a JSONB difference rather than a list
-- of comparisons so a column added later counts as content by default.
CREATE OR REPLACE FUNCTION public.touch_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  organisational TEXT[] := ARRAY['is_pinned', 'display_order', 'updated_at'];
BEGIN
  IF (to_jsonb(NEW) - organisational)
     IS NOT DISTINCT FROM (to_jsonb(OLD) - organisational) THEN
    NEW.updated_at = OLD.updated_at;
  ELSE
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_notes_updated_at ON notes;
CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes FOR EACH ROW EXECUTE FUNCTION public.touch_notes_updated_at();

-- Excalidraw whiteboards. `elements`, `app_state`, and `files` are the scene
-- exactly as the library serializes it, so a board always round-trips.
-- `preview` is an SVG string rendered at save time, so the gallery can show
-- thumbnails without loading a single scene.
CREATE TABLE IF NOT EXISTS whiteboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  app_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  files JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview TEXT,
  tags TEXT[],
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE whiteboards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage whiteboards" ON whiteboards;
CREATE POLICY "Admin manage whiteboards" ON whiteboards FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_whiteboards_updated_at ON whiteboards;
CREATE TRIGGER update_whiteboards_updated_at BEFORE UPDATE ON whiteboards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  is_all_day BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage events" ON events;
CREATE POLICY "Admin manage events" ON events FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =========================================================
-- 7. LEARNING HUB
-- =========================================================

CREATE TABLE IF NOT EXISTS learning_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Weekly, not daily: a daily target turns one bad Tuesday into a failure.
  target_minutes_per_week INT CHECK (target_minutes_per_week IS NULL OR (target_minutes_per_week >= 5 AND target_minutes_per_week <= 10080)),
  archived_at TIMESTAMPTZ,
  display_order INT4 DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Subject names are unique per owner, not across the table. The old
-- inline UNIQUE made one user's "Math" block every other user's.
ALTER TABLE learning_subjects DROP CONSTRAINT IF EXISTS learning_subjects_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS learning_subjects_user_name_idx
  ON learning_subjects (user_id, name);
ALTER TABLE learning_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage subjects" ON learning_subjects;
CREATE POLICY "Admin manage subjects" ON learning_subjects FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_learning_subjects_updated_at ON learning_subjects;
CREATE TRIGGER update_learning_subjects_updated_at BEFORE UPDATE ON learning_subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS learning_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  subject_id UUID REFERENCES learning_subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status learning_status DEFAULT 'To Learn',
  core_notes TEXT,
  resources JSONB,
  confidence_score INT2 CHECK (confidence_score BETWEEN 1 AND 5),
  -- Spaced review. `due_date` NULL means never reviewed — new, not overdue.
  ease NUMERIC NOT NULL DEFAULT 2.5 CHECK (ease >= 1.3 AND ease <= 3.5),
  interval_days INT NOT NULL DEFAULT 0 CHECK (interval_days >= 0 AND interval_days <= 3650),
  due_date DATE,
  last_reviewed_at TIMESTAMPTZ,
  review_count INT NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  lapses INT NOT NULL DEFAULT 0 CHECK (lapses >= 0),
  archived_at TIMESTAMPTZ,
  display_order INT4 DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Not everything you learn is a flashcard: reference material is read,
-- recall is the classic prompt-then-reveal, and quiz carries a right answer to
-- be marked against.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learning_material_kind') THEN
    CREATE TYPE learning_material_kind AS ENUM ('reference', 'recall', 'quiz');
  END IF;
END $$;

ALTER TABLE learning_topics
  ADD COLUMN IF NOT EXISTS kind learning_material_kind NOT NULL DEFAULT 'recall';

ALTER TABLE learning_topics
  ADD COLUMN IF NOT EXISTS prompt TEXT;

ALTER TABLE learning_topics
  ADD COLUMN IF NOT EXISTS answer TEXT;

-- Multiple choice, when there is any. An array of strings; the correct one is
-- `answer`, matched by value rather than by index, because reordering the
-- options in the editor must not silently change which one is right.
ALTER TABLE learning_topics
  ADD COLUMN IF NOT EXISTS choices JSONB;

DO $$
BEGIN
  -- Bounds mirror the Zod schema, so a value the form accepts cannot be one
  -- Postgres rejects — which surfaces as an opaque save failure.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learning_topics_prompt_len'
  ) THEN
    ALTER TABLE learning_topics
      ADD CONSTRAINT learning_topics_prompt_len
      CHECK (prompt IS NULL OR char_length(prompt) <= 2000);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'learning_topics_answer_len'
  ) THEN
    ALTER TABLE learning_topics
      ADD CONSTRAINT learning_topics_answer_len
      CHECK (answer IS NULL OR char_length(answer) <= 2000);
  END IF;
END $$;

-- Reference material never becomes due, so it never appears in the queue and
-- never counts as overdue. The partial index matches the query that reads it.
CREATE INDEX IF NOT EXISTS learning_topics_reviewable_idx
  ON learning_topics(due_date)
  WHERE kind <> 'reference' AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS learning_topics_due_date_idx ON learning_topics(due_date);
CREATE INDEX IF NOT EXISTS learning_topics_archived_at_idx ON learning_topics(archived_at);
ALTER TABLE learning_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage topics" ON learning_topics;
CREATE POLICY "Admin manage topics" ON learning_topics FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_learning_topics_updated_at ON learning_topics;
CREATE TRIGGER update_learning_topics_updated_at BEFORE UPDATE ON learning_topics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  topic_id UUID NOT NULL REFERENCES learning_topics(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INT CHECK (duration_minutes IS NULL OR (duration_minutes >= 0 AND duration_minutes <= 1440)),
  journal_notes TEXT,
  ended_early BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS learning_sessions_topic_id_idx ON learning_sessions(topic_id);
CREATE INDEX IF NOT EXISTS learning_sessions_start_time_idx ON learning_sessions(start_time);

-- Review history, kept apart from the topic's current state so the schedule can
-- be recomputed and retention is answerable.
CREATE TABLE IF NOT EXISTS learning_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  topic_id UUID NOT NULL REFERENCES learning_topics(id) ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rating TEXT NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  interval_before INT,
  interval_after INT,
  ease_after NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE learning_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage learning reviews" ON learning_reviews;
CREATE POLICY "Admin manage learning reviews" ON learning_reviews FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
CREATE INDEX IF NOT EXISTS learning_reviews_topic_id_idx ON learning_reviews(topic_id);
CREATE INDEX IF NOT EXISTS learning_reviews_reviewed_at_idx ON learning_reviews(reviewed_at);
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage sessions" ON learning_sessions;
CREATE POLICY "Admin manage sessions" ON learning_sessions FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());


-- =========================================================
-- 8. LIFESTYLE — Habits, Focus, Inventory
-- =========================================================

CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT NOT NULL,
  color TEXT DEFAULT '#0ea5e9',
  -- 'build' is a habit to do, 'quit' one to avoid, where a log is a slip.
  kind TEXT NOT NULL DEFAULT 'build' CHECK (kind IN ('build', 'quit')),
  -- Quantified habits; a plain check-in is target_value 1 with no unit.
  target_value NUMERIC NOT NULL DEFAULT 1 CHECK (target_value > 0 AND target_value <= 100000),
  unit TEXT CHECK (unit IS NULL OR length(unit) <= 24),
  step NUMERIC NOT NULL DEFAULT 1 CHECK (step > 0 AND step <= 100000),
  -- Which days it is due. Without this, target_per_week had no notion of
  -- *when*, so a Mon/Wed/Fri habit broke its streak every Tuesday.
  schedule TEXT NOT NULL DEFAULT 'daily' CHECK (schedule IN ('daily', 'weekdays', 'weekends', 'custom', 'weekly_count')),
  schedule_days INT[],  -- ISO weekdays, 1 = Monday … 7 = Sunday
  target_per_week INT DEFAULT 7 CHECK (target_per_week IS NULL OR (target_per_week >= 1 AND target_per_week <= 7)),
  time_of_day TEXT NOT NULL DEFAULT 'anytime' CHECK (time_of_day IN ('anytime', 'morning', 'afternoon', 'evening')),
  category TEXT,
  notes TEXT,
  display_order INT4 DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT habits_custom_needs_days CHECK (schedule <> 'custom' OR (schedule_days IS NOT NULL AND array_length(schedule_days, 1) >= 1)),
  CONSTRAINT habits_schedule_days_valid CHECK (schedule_days IS NULL OR (
    array_length(schedule_days, 1) <= 7
    -- `<@` rather than a subquery: CHECK constraints cannot contain one,
    -- and Postgres rejects the whole statement if they do.
    AND schedule_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]
  ))
);
CREATE INDEX IF NOT EXISTS habits_archived_at_idx ON habits(archived_at);
ALTER TABLE habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage habits" ON habits;
CREATE POLICY "Admin manage habits" ON habits FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_habits_updated_at ON habits;
CREATE TRIGGER update_habits_updated_at BEFORE UPDATE ON habits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  -- How much was done that day. Absent row means "not done"; a zero-value row
  -- would mean every untouched day needed one.
  value NUMERIC NOT NULL DEFAULT 1 CHECK (value >= 0 AND value <= 100000),
  note TEXT CHECK (note IS NULL OR length(note) <= 500),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(habit_id, completed_date)
);
CREATE INDEX IF NOT EXISTS habit_logs_completed_date_idx ON habit_logs(completed_date);
ALTER TABLE habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage habit logs" ON habit_logs;
CREATE POLICY "Admin manage habit logs" ON habit_logs FOR ALL USING (
  public.is_aal2()
  AND EXISTS (SELECT 1 FROM habits WHERE id = habit_logs.habit_id AND user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS focus_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL,
  completed BOOLEAN DEFAULT false,
  mode TEXT CHECK (mode IN ('work', 'break')) DEFAULT 'work',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE focus_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage focus" ON focus_logs;
CREATE POLICY "Admin manage focus" ON focus_logs FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name TEXT NOT NULL,
  category TEXT,
  serial_number TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  purchase_price NUMERIC(10, 2),
  current_value NUMERIC(10, 2),
  image_url TEXT,
  notes TEXT,
  -- Where the thing is. The question a home inventory is actually asked.
  location TEXT CHECK (location IS NULL OR length(location) <= 120),
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 100000),
  tags TEXT[],
  -- Sold, gifted, lost, discarded — the object is gone but its purchase price
  -- is the one number still worth keeping.
  archived_at TIMESTAMPTZ,
  archived_reason TEXT CHECK (archived_reason IS NULL OR archived_reason IN ('sold', 'gifted', 'lost', 'discarded', 'returned')),
  -- The ledger transaction that bought it. The FK is added after
  -- `money_transaction` exists, further down, because this table is
  -- created long before that one.
  transaction_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT inventory_reason_needs_archive CHECK (archived_reason IS NULL OR archived_at IS NOT NULL),
  CONSTRAINT inventory_warranty_after_purchase CHECK (purchase_date IS NULL OR warranty_expiry IS NULL OR warranty_expiry >= purchase_date)
);
-- The currency the item was bought and valued in. NULL means the
-- money base currency, so rows written before this column keep their meaning.
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS currency CHAR(3)
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$');
CREATE INDEX IF NOT EXISTS inventory_items_archived_at_idx ON inventory_items(archived_at);
CREATE INDEX IF NOT EXISTS inventory_items_warranty_expiry_idx ON inventory_items(warranty_expiry);
CREATE INDEX IF NOT EXISTS inventory_items_location_idx ON inventory_items(location);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage inventory" ON inventory_items;
CREATE POLICY "Admin manage inventory" ON inventory_items FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory_items;
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage Assets Metadata
CREATE TABLE IF NOT EXISTS storage_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_kb NUMERIC,
  alt_text TEXT,
  used_in JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE storage_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage assets" ON storage_assets;
CREATE POLICY "Admin manage assets" ON storage_assets FOR ALL USING (auth.uid() = user_id AND public.is_aal2()) WITH CHECK (auth.uid() = user_id AND public.is_aal2());


-- =========================================================
-- 9. PUBLIC NOTES (Life Updates)
-- =========================================================

CREATE TABLE IF NOT EXISTS public_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  title TEXT,
  content TEXT,
  category TEXT CHECK (category IN ('watching', 'activity', 'photo', 'thought', 'milestone')) DEFAULT 'thought',
  image_url TEXT,
  tags TEXT[],
  is_pinned BOOLEAN DEFAULT false,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read published notes" ON public_notes;
CREATE POLICY "Public read published notes" ON public_notes FOR SELECT USING (is_published = true);
DROP POLICY IF EXISTS "Admin manage public notes" ON public_notes;
CREATE POLICY "Admin manage public notes" ON public_notes FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP TRIGGER IF EXISTS update_public_notes_updated_at ON public_notes;
CREATE TRIGGER update_public_notes_updated_at BEFORE UPDATE ON public_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =========================================================
-- 10. CONTACT SUBMISSIONS
-- =========================================================

-- The only table an unauthenticated visitor may write to. Bounds mirror LIMITS
-- in src/lib/schemas.ts, and the rate-limit trigger below is the only thing
-- standing between `WITH CHECK (true)` and an unbounded number of rows.
CREATE TABLE IF NOT EXISTS contact_submissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  replied_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT contact_submissions_length_check CHECK (
    char_length(name)    BETWEEN 2 AND 200
    AND char_length(email)   BETWEEN 3 AND 320
    AND char_length(subject) BETWEEN 3 AND 200
    AND char_length(message) BETWEEN 10 AND 5000
  )
);
-- What the message is about: the one "Work with me" path serves
-- roles, projects and anything else, and the owner triages by it. Nullable:
-- messages from before the question have no answer to it.
ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS topic TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contact_submissions_topic_check'
  ) THEN
    ALTER TABLE contact_submissions
      ADD CONSTRAINT contact_submissions_topic_check
      CHECK (topic IS NULL OR topic IN ('role', 'project', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contact_submissions_inbox_idx
  ON contact_submissions (is_archived, created_at DESC);
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public insert contact" ON contact_submissions;
CREATE POLICY "Public insert contact" ON contact_submissions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin read contact" ON contact_submissions;
CREATE POLICY "Admin read contact" ON contact_submissions FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admin update contact" ON contact_submissions;
CREATE POLICY "Admin update contact" ON contact_submissions FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Admin delete contact" ON contact_submissions;
CREATE POLICY "Admin delete contact" ON contact_submissions FOR DELETE USING (public.is_admin());

-- Refuses 3 submissions per address per hour, or 10 site-wide per minute.
CREATE OR REPLACE FUNCTION public.limit_contact_submissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  per_email INT;
  per_minute INT;
BEGIN
  SELECT count(*) INTO per_email FROM contact_submissions
   WHERE lower(email) = lower(NEW.email) AND created_at > now() - interval '1 hour';
  IF per_email >= 3 THEN
    RAISE EXCEPTION 'Too many messages from this address. Try again later.'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO per_minute FROM contact_submissions
   WHERE created_at > now() - interval '1 minute';
  IF per_minute >= 10 THEN
    RAISE EXCEPTION 'The contact form is busy. Try again in a moment.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS limit_contact_submissions ON contact_submissions;
CREATE TRIGGER limit_contact_submissions BEFORE INSERT ON contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.limit_contact_submissions();


-- Integration secrets. Deliberately NOT in site_identity, which is
-- `FOR SELECT USING (true)` — a webhook URL there would be world-readable.
-- There is no public read policy; the notify trigger reaches the row through
-- SECURITY DEFINER so an anonymous INSERT can fire a notification without the
-- anon role ever being able to read the URL.
CREATE TABLE IF NOT EXISTS integration_settings (
  id                  INT PRIMARY KEY DEFAULT 1,
  contact_webhook_url TEXT,
  notify_on_contact   BOOLEAN NOT NULL DEFAULT true,
  visit_webhook_url   TEXT,
  -- Off by default: a ping per visit is noise you mute within a week, and a
  -- muted channel tells you nothing.
  notify_on_visit     BOOLEAN NOT NULL DEFAULT false,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT integration_settings_single_row CHECK (id = 1)
);
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage integrations" ON integration_settings;
CREATE POLICY "Admin manage integrations" ON integration_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS market_data_key TEXT;

ALTER TABLE integration_settings
  ADD COLUMN IF NOT EXISTS market_data_provider TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'integration_settings_market_key_len'
  ) THEN
    ALTER TABLE integration_settings
      ADD CONSTRAINT integration_settings_market_key_len
      CHECK (market_data_key IS NULL OR char_length(market_data_key) <= 200);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- The watchlist
-- ----------------------------------------------------------------------------
--
-- Stores *what to ask for*, never what came back — the same rule the rest of
-- Discover follows. Caching a quote means deciding when it goes stale, and a
-- stale quote presented as current is worse than no quote at all.

CREATE TABLE IF NOT EXISTS discover_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- The ticker as the provider spells it. Case is preserved because some
  -- venues are case-sensitive; uniqueness is not, because typing "aapl" twice
  -- should not produce two rows.
  symbol TEXT NOT NULL CHECK (char_length(symbol) BETWEEN 1 AND 32),
  name TEXT CHECK (name IS NULL OR char_length(name) <= 200),
  kind TEXT NOT NULL DEFAULT 'stock'
    CHECK (kind IN ('stock', 'etf', 'fund', 'index', 'crypto', 'bond')),
  -- Where it trades, when the symbol alone is ambiguous — SHOP is Shopify on
  -- both the NYSE and the TSX, at different prices in different currencies.
  exchange TEXT CHECK (exchange IS NULL OR char_length(exchange) <= 32),
  currency TEXT CHECK (currency IS NULL OR char_length(currency) = 3),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  display_order INT4 DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discover_watchlist_symbol_idx
  ON discover_watchlist(user_id, lower(symbol), coalesce(exchange, ''));

ALTER TABLE discover_watchlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage watchlist" ON discover_watchlist;
CREATE POLICY "Admin manage watchlist" ON discover_watchlist
  FOR ALL USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

DROP TRIGGER IF EXISTS update_integration_settings_updated_at ON integration_settings;
CREATE TRIGGER update_integration_settings_updated_at BEFORE UPDATE ON integration_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_contact_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  settings integration_settings%ROWTYPE;
BEGIN
  SELECT * INTO settings FROM integration_settings WHERE id = 1;

  IF settings.contact_webhook_url IS NULL
     OR settings.contact_webhook_url = ''
     OR NOT settings.notify_on_contact THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := settings.contact_webhook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'username', 'Portfolio Contact',
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', 'New contact form submission',
        'color', 5814783,
        'fields', jsonb_build_array(
          jsonb_build_object('name', 'About',   'value', CASE NEW.topic
                                                        WHEN 'role'    THEN 'A role'
                                                        WHEN 'project' THEN 'A project'
                                                        WHEN 'other'   THEN 'Something else'
                                                        ELSE 'Not given' END, 'inline', true),
          jsonb_build_object('name', 'Name',    'value', left(NEW.name, 256),  'inline', true),
          jsonb_build_object('name', 'Email',   'value', left(NEW.email, 256), 'inline', true),
          jsonb_build_object('name', 'Subject', 'value', left(NEW.subject, 256)),
          jsonb_build_object('name', 'Message', 'value', left(NEW.message, 1000))
        ),
        'timestamp', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'footer', jsonb_build_object('text', 'Reply from Admin → Inbox')
      ))
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Best-effort: losing the ping is a nuisance, losing the message is not
  -- acceptable.
  RAISE WARNING 'contact notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_contact_submission ON contact_submissions;
CREATE TRIGGER notify_contact_submission AFTER INSERT ON contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_contact_submission();


-- =========================================================
-- 10b. VISITOR ANALYTICS
-- =========================================================
-- One row per visit. No IP address is ever stored: the trigger reads
-- x-forwarded-for from the PostgREST request and keeps only
-- sha256(secret || current_date || ip || user_agent), so unique-visitor
-- counts are accurate within a day and the column identifies nobody.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


-- ── 1. The secret behind the hash ───────────────────────────────────────────
--
-- Its own table with no policies at all, so no client role can read it through
-- PostgREST under any circumstances. Only SECURITY DEFINER functions reach it.

CREATE TABLE IF NOT EXISTS analytics_secret (
  id     INT PRIMARY KEY DEFAULT 1,
  secret TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  CONSTRAINT analytics_secret_single_row CHECK (id = 1)
);
ALTER TABLE analytics_secret ENABLE ROW LEVEL SECURITY;
-- Deliberately no policy. RLS with no policy denies everything.
INSERT INTO analytics_secret (id) VALUES (1) ON CONFLICT DO NOTHING;


-- ── 2. Visits ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS site_visits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Daily-salted, irreversible. Set by the trigger; anything the client sends
  -- for this column is overwritten.
  visitor_hash  TEXT,

  path          TEXT NOT NULL,
  -- Host only. A full referrer URL can carry someone else's query string.
  referrer_host TEXT,
  source        TEXT,
  channel       TEXT CHECK (channel IN ('direct','search','social','referral','campaign')),
  utm_source    TEXT,
  utm_medium    TEXT,
  utm_campaign  TEXT,

  country       TEXT,
  region        TEXT,
  city          TEXT,
  network       TEXT,
  timezone      TEXT,
  language      TEXT,

  browser       TEXT,
  os            TEXT,
  device        TEXT CHECK (device IN ('desktop','mobile','tablet')),
  screen_width  INT,

  is_bot        BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- The same discipline as contact_submissions: this is a table an anonymous
  -- visitor writes to, so every free-text column has a ceiling.
  CONSTRAINT site_visits_length_check CHECK (
    char_length(path) <= 512
    AND char_length(coalesce(referrer_host, '')) <= 255
    AND char_length(coalesce(source, '')) <= 128
    AND char_length(coalesce(utm_source, '')) <= 128
    AND char_length(coalesce(utm_medium, '')) <= 128
    AND char_length(coalesce(utm_campaign, '')) <= 128
    AND char_length(coalesce(country, '')) <= 2
    AND char_length(coalesce(region, '')) <= 128
    AND char_length(coalesce(city, '')) <= 128
    AND char_length(coalesce(network, '')) <= 200
    AND char_length(coalesce(timezone, '')) <= 64
    AND char_length(coalesce(language, '')) <= 32
    AND char_length(coalesce(browser, '')) <= 64
    AND char_length(coalesce(os, '')) <= 64
  )
);

-- Every dashboard query is "recent, excluding bots", then grouped.
CREATE INDEX IF NOT EXISTS site_visits_recent_idx
  ON site_visits (created_at DESC) WHERE is_bot = false;
CREATE INDEX IF NOT EXISTS site_visits_visitor_idx
  ON site_visits (visitor_hash, created_at DESC);
-- All rows, bots included: the rate limiter's per-minute and daily counts.
CREATE INDEX IF NOT EXISTS site_visits_created_idx
  ON site_visits (created_at DESC);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public insert visits" ON site_visits;
CREATE POLICY "Public insert visits" ON site_visits FOR INSERT WITH CHECK (true);

-- Read is the owner's alone. A public SELECT here would publish the whole
-- audience log to anyone who found the table name.
DROP POLICY IF EXISTS "Admin read visits" ON site_visits;
CREATE POLICY "Admin read visits" ON site_visits FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admin delete visits" ON site_visits;
CREATE POLICY "Admin delete visits" ON site_visits FOR DELETE USING (public.is_admin());
-- No UPDATE policy: a visit is a fact, not a record to be edited.


-- ── 3. Server-side enrichment ───────────────────────────────────────────────
--
-- Everything the client cannot be trusted with, or does not know.

CREATE OR REPLACE FUNCTION public.enrich_site_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  headers   JSON;
  forwarded TEXT;
  client_ip TEXT;
  agent     TEXT;
  salt      TEXT;
BEGIN
  headers := nullif(current_setting('request.headers', true), '')::json;

  IF headers IS NOT NULL THEN
    forwarded := headers ->> 'x-forwarded-for';
    agent     := headers ->> 'user-agent';
  END IF;

  -- "client, proxy1, proxy2" — the first entry is the original client. It is
  -- forgeable by the caller, which for a personal analytics table means someone
  -- can corrupt their own row in your statistics and nothing else.
  client_ip := split_part(coalesce(forwarded, ''), ',', 1);
  client_ip := btrim(client_ip);

  SELECT secret INTO salt FROM analytics_secret WHERE id = 1;

  IF client_ip <> '' AND salt IS NOT NULL THEN
    NEW.visitor_hash := encode(
      extensions.digest(
        salt || current_date::text || client_ip || coalesce(agent, ''),
        'sha256'
      ),
      'hex'
    );
  ELSE
    NEW.visitor_hash := NULL;
  END IF;

  -- Bots are flagged, not refused. "60% of this traffic is Googlebot" is worth
  -- knowing, and a filter that silently discards is one you cannot check.
  IF agent IS NOT NULL AND agent ~* '(bot\b|crawler|spider|crawl|slurp|facebookexternalhit|headlesschrome|lighthouse|pagespeed|pingdom|uptimerobot|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|applebot|discordbot|slackbot|telegrambot|twitterbot|linkedinbot|preview|monitor|curl|wget|python-requests|node-fetch|go-http-client|okhttp)' THEN
    NEW.is_bot := true;
  END IF;

  -- Never client-settable.
  NEW.created_at := now();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enrich_site_visit() IS
  'Derives visitor_hash from the request IP and a daily-rotating secret salt, and flags known bots. The raw IP is used and discarded within the statement — it is never stored.';

DROP TRIGGER IF EXISTS enrich_site_visit ON site_visits;
CREATE TRIGGER enrich_site_visit
  BEFORE INSERT ON site_visits
  FOR EACH ROW EXECUTE FUNCTION public.enrich_site_visit();


-- ── 4. Rate limit ───────────────────────────────────────────────────────────
--
-- The same exposure as contact_submissions: an anonymous INSERT policy with no
-- ceiling is an invitation to fill the database. Generous enough that a person
-- clicking through every page never notices.

CREATE OR REPLACE FUNCTION public.limit_site_visits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent INT;
BEGIN
  IF NEW.visitor_hash IS NOT NULL THEN
    SELECT count(*) INTO recent FROM site_visits
     WHERE visitor_hash = NEW.visitor_hash
       AND created_at > now() - interval '1 minute';
    IF recent >= 30 THEN
      RETURN NULL; -- Silently dropped: telemetry must never break a page view.
    END IF;
  END IF;

  SELECT count(*) INTO recent FROM site_visits
   WHERE created_at > now() - interval '1 minute';
  IF recent >= 600 THEN
    RETURN NULL;
  END IF;

  -- Daily ceiling. The per-minute cap alone still admits ~864k rows a
  -- day, and the per-visitor cap keys on a hash of a forgeable header — enough
  -- to fill the free tier's 500 MB in about three days of sustained abuse. A
  -- personal site does not see 20k views a day; if it ever does, raise this.
  -- Bots count too: the caller writes the User-Agent that decides is_bot, so
  -- excluding them would let a flood opt out of the ceiling. Uses
  -- site_visits_created_idx, so the count stays an index scan.
  SELECT count(*) INTO recent FROM site_visits
   WHERE created_at > now() - interval '24 hours';
  IF recent >= 20000 THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Must run after enrichment, since it filters on the hash that trigger derives.
-- Postgres fires BEFORE triggers in alphabetical order by trigger name, and
-- "enrich_site_visit" sorts before "limit_site_visits" — that is load-bearing,
-- so do not rename either without checking the other.
DROP TRIGGER IF EXISTS limit_site_visits ON site_visits;
CREATE TRIGGER limit_site_visits
  BEFORE INSERT ON site_visits
  FOR EACH ROW EXECUTE FUNCTION public.limit_site_visits();


-- ── 5. Retention ────────────────────────────────────────────────────────────
--
-- The free tier gives 500 MB. A visit row is roughly 200 bytes, so a year of
-- serious traffic is still small — but a table nothing ever deletes from grows
-- until it is a problem, and the interesting window is the last few months.
--
-- Call it from the admin, or schedule it if pg_cron is enabled:
--   SELECT cron.schedule('prune-visits', '0 4 * * *', 'SELECT prune_site_visits()');

CREATE OR REPLACE FUNCTION public.prune_site_visits(keep_days INT DEFAULT 400)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Lockdown: definer rights bypass the restrictive policies, so
  -- write functions check the level themselves.
  IF public.writes_locked() THEN
    RAISE EXCEPTION 'Writes are locked: lower the lockdown level first'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM site_visits WHERE created_at < now() - (keep_days || ' days')::interval;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_site_visits(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prune_site_visits(INT) TO authenticated;


-- ── 6. The aggregate the dashboard reads ────────────────────────────────────
--
-- Aggregating in Postgres rather than shipping rows to the browser: a year of
-- traffic is tens of thousands of rows, and the admin only ever renders the
-- summary of them.

CREATE OR REPLACE FUNCTION public.get_visitor_analytics(
  days       INT DEFAULT 30,
  with_bots  BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  since  TIMESTAMPTZ := now() - (greatest(days, 1) || ' days')::interval;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH scoped AS (
    SELECT * FROM site_visits
     WHERE created_at >= since
       AND (with_bots OR is_bot = false)
  ),
  by_day AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS day,
           count(*)::INT AS views,
           count(DISTINCT visitor_hash)::INT AS visitors
      FROM scoped GROUP BY day ORDER BY day
  ),
  top_pages AS (
    SELECT path AS name, count(*)::INT AS value
      FROM scoped GROUP BY path ORDER BY value DESC LIMIT 10
  ),
  top_sources AS (
    SELECT coalesce(source, 'Direct') AS name, count(*)::INT AS value
      FROM scoped GROUP BY 1 ORDER BY value DESC LIMIT 10
  ),
  by_channel AS (
    SELECT coalesce(channel, 'direct') AS name, count(*)::INT AS value
      FROM scoped GROUP BY 1 ORDER BY value DESC
  ),
  by_country AS (
    SELECT country AS name, count(*)::INT AS value,
           count(DISTINCT visitor_hash)::INT AS visitors
      FROM scoped WHERE country IS NOT NULL GROUP BY country
     ORDER BY value DESC LIMIT 20
  ),
  by_city AS (
    SELECT city AS name, country, count(*)::INT AS value
      FROM scoped WHERE city IS NOT NULL GROUP BY city, country
     ORDER BY value DESC LIMIT 10
  ),
  by_network AS (
    SELECT network AS name, count(*)::INT AS value
      FROM scoped WHERE network IS NOT NULL GROUP BY network
     ORDER BY value DESC LIMIT 10
  ),
  by_browser AS (
    SELECT coalesce(browser, 'Other') AS name, count(*)::INT AS value
      FROM scoped GROUP BY 1 ORDER BY value DESC LIMIT 8
  ),
  by_os AS (
    SELECT coalesce(os, 'Other') AS name, count(*)::INT AS value
      FROM scoped GROUP BY 1 ORDER BY value DESC LIMIT 8
  ),
  by_device AS (
    SELECT coalesce(device, 'desktop') AS name, count(*)::INT AS value
      FROM scoped GROUP BY 1 ORDER BY value DESC
  ),
  by_hour AS (
    SELECT extract(hour FROM created_at AT TIME ZONE 'UTC')::INT AS hour,
           count(*)::INT AS value
      FROM scoped GROUP BY hour ORDER BY hour
  )
  SELECT jsonb_build_object(
    'range_days',    days,
    'total_views',   (SELECT count(*)::INT FROM scoped),
    'total_visitors',(SELECT count(DISTINCT visitor_hash)::INT FROM scoped),
    'bot_views',     (SELECT count(*)::INT FROM site_visits WHERE created_at >= since AND is_bot),
    'by_day',        coalesce((SELECT jsonb_agg(to_jsonb(by_day)) FROM by_day), '[]'::jsonb),
    'top_pages',     coalesce((SELECT jsonb_agg(to_jsonb(top_pages)) FROM top_pages), '[]'::jsonb),
    'top_sources',   coalesce((SELECT jsonb_agg(to_jsonb(top_sources)) FROM top_sources), '[]'::jsonb),
    'by_channel',    coalesce((SELECT jsonb_agg(to_jsonb(by_channel)) FROM by_channel), '[]'::jsonb),
    'by_country',    coalesce((SELECT jsonb_agg(to_jsonb(by_country)) FROM by_country), '[]'::jsonb),
    'by_city',       coalesce((SELECT jsonb_agg(to_jsonb(by_city)) FROM by_city), '[]'::jsonb),
    'by_network',    coalesce((SELECT jsonb_agg(to_jsonb(by_network)) FROM by_network), '[]'::jsonb),
    'by_browser',    coalesce((SELECT jsonb_agg(to_jsonb(by_browser)) FROM by_browser), '[]'::jsonb),
    'by_os',         coalesce((SELECT jsonb_agg(to_jsonb(by_os)) FROM by_os), '[]'::jsonb),
    'by_device',     coalesce((SELECT jsonb_agg(to_jsonb(by_device)) FROM by_device), '[]'::jsonb),
    'by_hour',       coalesce((SELECT jsonb_agg(to_jsonb(by_hour)) FROM by_hour), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_visitor_analytics(INT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visitor_analytics(INT, BOOLEAN) TO authenticated;


-- ── 7. Where the visit webhook lives now ────────────────────────────────────
--
-- Same move as the contact webhook in 007, for the same reason:
-- `NEXT_PUBLIC_VISIT_NOTIFIER_URL` is compiled into the public bundle, and a
-- Discord webhook URL is full authority to post in that channel.
--
-- Deduplicated to the first visit of the day per visitor, because a ping on
-- every page view is noise you will mute within a week — and a muted channel
-- tells you nothing.

CREATE OR REPLACE FUNCTION public.notify_site_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  settings integration_settings%ROWTYPE;
  seen     INT;
BEGIN
  IF NEW.is_bot THEN RETURN NEW; END IF;

  SELECT * INTO settings FROM integration_settings WHERE id = 1;
  IF settings.visit_webhook_url IS NULL
     OR settings.visit_webhook_url = ''
     OR NOT settings.notify_on_visit THEN
    RETURN NEW;
  END IF;

  -- First visit of the day for this visitor, or nothing.
  SELECT count(*) INTO seen FROM site_visits
   -- IS NOT DISTINCT FROM, not =: a visit with no hash (no forwarded IP)
   -- compared NULL = NULL, matched nothing, and pinged on every page view.
   WHERE visitor_hash IS NOT DISTINCT FROM NEW.visitor_hash
     AND id <> NEW.id
     AND created_at >= current_date;
  IF seen > 0 THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url     := settings.visit_webhook_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'username', 'Portfolio',
      'embeds', jsonb_build_array(jsonb_build_object(
        'title', 'New visitor',
        'color', 3447003,
        'fields', jsonb_build_array(
          jsonb_build_object('name', 'Page',    'value', left(NEW.path, 256), 'inline', true),
          jsonb_build_object('name', 'From',    'value', coalesce(NEW.source, 'Direct'), 'inline', true),
          jsonb_build_object('name', 'Where',   'value', coalesce(nullif(concat_ws(', ', NEW.city, NEW.country), ''), 'Unknown'), 'inline', true),
          jsonb_build_object('name', 'Device',  'value', concat_ws(' · ', NEW.browser, NEW.os, NEW.device), 'inline', true)
        ),
        'timestamp', to_char(NEW.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      ))
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'visit notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_site_visit ON site_visits;
CREATE TRIGGER notify_site_visit
  AFTER INSERT ON site_visits
  FOR EACH ROW EXECUTE FUNCTION public.notify_site_visit();

-- =========================================================
-- 10d. CALENDAR
-- =========================================================
-- Calendars, recurrence and a range query that filters on overlap.
--
-- The previous get_calendar_data filtered on start_time::date BETWEEN, so
-- any event spanning a view boundary was invisible from the far side. It
-- also gave summary rows a fresh gen_random_uuid() on every call, and
-- invented clock times for date-only records (tasks 09:00, habits 07:00,
-- transactions 12:00). All three are fixed below.
--
-- Recurring series are returned unexpanded with their rule attached: a
-- weekly 09:00 standup is 09:00 local on both sides of a clock change,
-- which is a property of the viewer's timezone rather than of the row.

-- ── 1. Calendars ────────────────────────────────────────────────────────────
--
-- Colour is stored as a **token name**, not a hex value. The previous module
-- hard-coded nine literals copied from Google Calendar's palette, which do not
-- move with any of the 52 theme presets — the v3 rules forbid exactly that.

CREATE TABLE IF NOT EXISTS calendars (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  -- One of the app's chart tokens, resolved to a real colour at render time.
  color_token TEXT NOT NULL DEFAULT 'chart-1'
              CHECK (color_token ~ '^chart-[1-5]$'),
  is_visible  BOOLEAN NOT NULL DEFAULT true,
  -- Where a new event lands when you do not pick one.
  is_default  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, name)
);
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage calendars" ON calendars;
CREATE POLICY "Admin manage calendars" ON calendars FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_calendars_updated_at ON calendars;
CREATE TRIGGER update_calendars_updated_at BEFORE UPDATE ON calendars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Only one default at a time, enforced rather than hoped for.
CREATE UNIQUE INDEX IF NOT EXISTS calendars_one_default_idx
  ON calendars (user_id) WHERE is_default;


-- ── 2. Events grow up ───────────────────────────────────────────────────────

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location    TEXT CHECK (char_length(coalesce(location,'')) <= 300),
  -- Its own field rather than a URL buried in the description, so it can be a
  -- button you press thirty seconds before a call.
  ADD COLUMN IF NOT EXISTS meeting_url TEXT CHECK (char_length(coalesce(meeting_url,'')) <= 2048),
  ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('confirmed','tentative','cancelled')),
  /**
   * An RFC 5545 recurrence rule, stored as one string.
   *
   * A rule, not a thousand rows: a weekly standup with no end date is one
   * event, expanded for whatever range is on screen. Materialising occurrences
   * would mean deciding how far into the future to write, and rewriting all of
   * them every time the series is edited.
   *
   * Deliberately a text column with no CHECK. The app parses a focused subset
   * (FREQ, INTERVAL, BYDAY, COUNT, UNTIL) and a constraint here would either
   * duplicate that grammar badly or reject rules a future version understands.
   */
  ADD COLUMN IF NOT EXISTS rrule       TEXT CHECK (char_length(coalesce(rrule,'')) <= 500),
  -- Denormalised stop date, so a range query can skip series that ended.
  ADD COLUMN IF NOT EXISTS recurrence_end DATE,
  -- Overrides the calendar's colour for one event.
  ADD COLUMN IF NOT EXISTS color_token TEXT CHECK (color_token IS NULL OR color_token ~ '^chart-[1-5]$'),
  ADD COLUMN IF NOT EXISTS travel_minutes INT CHECK (travel_minutes IS NULL OR travel_minutes BETWEEN 0 AND 1440),
  ADD COLUMN IF NOT EXISTS reminder_minutes INT CHECK (reminder_minutes IS NULL OR reminder_minutes BETWEEN 0 AND 40320),
  -- A time block for a task. Completing one completes the other.
  ADD COLUMN IF NOT EXISTS task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL;

-- The range query below scans on overlap, so both ends are indexed.
CREATE INDEX IF NOT EXISTS events_range_idx ON events (user_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS events_recurring_idx
  ON events (user_id) WHERE rrule IS NOT NULL;


-- ── 3. Exceptions to a series ───────────────────────────────────────────────
--
-- What lets you skip one standup, or move a single Thursday, without deleting
-- the rule. Keyed by the occurrence's *original* start, because that is the
-- only stable identifier an expanded occurrence has — it is computed from the
-- rule rather than stored.

CREATE TABLE IF NOT EXISTS event_exceptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  /** The start this occurrence would have had, before any override. */
  original_start TIMESTAMPTZ NOT NULL,
  /** True for a deleted occurrence; the override columns are then ignored. */
  is_cancelled   BOOLEAN NOT NULL DEFAULT false,
  new_start      TIMESTAMPTZ,
  new_end        TIMESTAMPTZ,
  new_title      TEXT CHECK (char_length(coalesce(new_title,'')) <= 300),
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, original_start)
);
ALTER TABLE event_exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage event exceptions" ON event_exceptions;
CREATE POLICY "Admin manage event exceptions" ON event_exceptions FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());


-- ── 4. Calendar settings ────────────────────────────────────────────────────
--
-- `home_timezone` is the whole reason the week grid has two hour gutters. Same
-- shape as `finance_settings.home_currency`: the module knows you live away
-- from the people you are trying to call.

CREATE TABLE IF NOT EXISTS calendar_settings (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  /** IANA zone, e.g. 'Asia/Kolkata'. Null hides the second gutter entirely. */
  home_timezone  TEXT CHECK (char_length(coalesce(home_timezone,'')) <= 64),
  /** Where the grid starts and stops, so the day is not 24 rows of nothing. */
  day_start_hour INT NOT NULL DEFAULT 7 CHECK (day_start_hour BETWEEN 0 AND 23),
  day_end_hour   INT NOT NULL DEFAULT 22 CHECK (day_end_hour BETWEEN 1 AND 24),
  week_starts_on INT NOT NULL DEFAULT 1 CHECK (week_starts_on BETWEEN 0 AND 6),
  default_view   TEXT NOT NULL DEFAULT 'week'
                 CHECK (default_view IN ('day','week','month','agenda')),
  /** Overlay toggles for the aggregated modules. */
  show_tasks     BOOLEAN NOT NULL DEFAULT true,
  show_habits    BOOLEAN NOT NULL DEFAULT false,
  show_finance   BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT calendar_day_bounds CHECK (day_end_hour > day_start_hour)
);
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage calendar settings" ON calendar_settings;
CREATE POLICY "Admin manage calendar settings" ON calendar_settings FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_calendar_settings_updated_at ON calendar_settings;
CREATE TRIGGER update_calendar_settings_updated_at BEFORE UPDATE ON calendar_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── 5. The rewritten range query ────────────────────────────────────────────
--
-- Three fixes, described at the top of this file: overlap instead of start
-- date, deterministic ids, and no invented clock times.
--
-- Recurring events are returned as their **series rows**, unexpanded, with the
-- rule attached. Expansion happens on the client, which already knows the
-- viewer's timezone — expanding in Postgres would mean deciding a zone in SQL,
-- and a weekly 09:00 standup is 09:00 local on both sides of a clock change,
-- which is a property of the viewer rather than of the row.

CREATE OR REPLACE FUNCTION public.get_calendar_data(
  start_date_param DATE,
  end_date_param   DATE
)
RETURNS TABLE (
  item_id    TEXT,
  title      TEXT,
  start_time TIMESTAMPTZ,
  end_time   TIMESTAMPTZ,
  item_type  TEXT,
  is_all_day BOOLEAN,
  data       JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  -- AAL2 as well as signed in. SECURITY DEFINER bypasses RLS, and every table
  -- read below is protected by a policy requiring the second factor — so
  -- without this the function hands a password-only session data the policies
  -- would have withheld.
  IF uid IS NULL OR NOT public.is_aal2() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
  -- Events. Overlap, not start date: an event belongs in the window if it
  -- starts before the window ends and finishes after the window begins.
  -- Recurring series are always returned so the client can expand them.
  SELECT
    e.id::text,
    e.title,
    e.start_time,
    e.end_time,
    'event',
    coalesce(e.is_all_day, false),
    jsonb_build_object(
      'description', e.description,
      'location', e.location,
      'meeting_url', e.meeting_url,
      'calendar_id', e.calendar_id,
      'color_token', e.color_token,
      'status', e.status,
      'rrule', e.rrule,
      'recurrence_end', e.recurrence_end,
      'travel_minutes', e.travel_minutes,
      'reminder_minutes', e.reminder_minutes,
      'task_id', e.task_id
    )
  FROM events e
  WHERE e.user_id = uid
    AND (
      e.rrule IS NOT NULL
        AND (e.recurrence_end IS NULL OR e.recurrence_end >= start_date_param)
        AND e.start_time < (end_date_param + 1)
      OR
      e.rrule IS NULL
        AND e.start_time < (end_date_param + 1)::timestamptz
        AND coalesce(e.end_time, e.start_time) >= start_date_param::timestamptz
    )

  UNION ALL

  -- Tasks with a due date. Returned all-day: a task due Tuesday is not a 9am
  -- appointment, and inventing one put it in a slot it never belonged in.
  SELECT
    'task-' || t.id::text,
    t.title,
    t.due_date::timestamptz,
    NULL,
    'task',
    true,
    jsonb_build_object(
      'status', t.status,
      'priority', t.priority,
      'project_id', t.project_id,
      'estimate_minutes', t.estimate_minutes
    )
  FROM tasks t
  WHERE t.user_id = uid
    AND t.due_date BETWEEN start_date_param AND end_date_param

  UNION ALL

  -- One summary row per day. The id is derived from the kind and the date, so
  -- it is the same object across refetches — usable as a key, selectable, and
  -- scrollable to.
  SELECT
    'habits-' || hl.completed_date::text,
    'Habits',
    hl.completed_date::timestamptz,
    NULL,
    'habit_summary',
    true,
    jsonb_build_object(
      'count', count(*),
      'habits', jsonb_agg(jsonb_build_object('title', h.title, 'color', h.color))
    )
  FROM habit_logs hl
  JOIN habits h ON hl.habit_id = h.id
  WHERE h.user_id = uid
    AND hl.completed_date BETWEEN start_date_param AND end_date_param
  GROUP BY hl.completed_date

  UNION ALL

  -- Money, from the ledger. `money_day_flows` is defined further
  -- down, with the tables it reads; a plpgsql body is not resolved until it
  -- runs, so the forward reference is fine here. The dashboard reads the same
  -- function, so the two cannot disagree about a day.
  SELECT
    'finance-' || m.day::text,
    'Money',
    m.day::timestamptz,
    NULL,
    'transaction_summary',
    true,
    jsonb_build_object(
      'count', m.entries,
      'earned', m.earned,
      'spent', m.spent
    )
  FROM public.money_day_flows(start_date_param, end_date_param) m;
END;
$$;

REVOKE ALL ON FUNCTION public.get_calendar_data(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_data(DATE, DATE) TO authenticated;


-- ── 6. Starter calendars ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.seed_calendar_defaults(home_tz TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL OR NOT public.is_aal2() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  -- Lockdown: definer rights bypass the restrictive policies, so
  -- write functions check the level themselves.
  IF public.writes_locked() THEN
    RAISE EXCEPTION 'Writes are locked: lower the lockdown level first'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO calendar_settings (user_id, home_timezone)
  VALUES (uid, home_tz) ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO calendars (user_id, name, color_token, is_default, sort_order)
  VALUES
    (uid, 'Personal', 'chart-1', true,  10),
    (uid, 'Work',     'chart-2', false, 20),
    (uid, 'Family',   'chart-3', false, 30),
    (uid, 'Health',   'chart-4', false, 40)
  ON CONFLICT (user_id, name) DO NOTHING;

  -- Existing events predate calendars; file them under the default rather than
  -- leaving them ungrouped and invisible to a calendar filter.
  UPDATE events e
     SET calendar_id = (
       SELECT c.id FROM calendars c
        WHERE c.user_id = uid AND c.is_default LIMIT 1
     )
   WHERE e.user_id = uid AND e.calendar_id IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_calendar_defaults(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_calendar_defaults(TEXT) TO authenticated;

-- =========================================================
-- 11. RPC FUNCTIONS
-- =========================================================

-- Ping (health check)
CREATE OR REPLACE FUNCTION ping() RETURNS text AS $$ BEGIN RETURN 'pong'; END; $$ LANGUAGE plpgsql;

-- Blog View Counter
CREATE OR REPLACE FUNCTION increment_blog_post_view(post_id_to_increment UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE blog_posts SET views = views + 1 WHERE id = post_id_to_increment AND published = true;
END;
$$;
GRANT EXECUTE ON FUNCTION increment_blog_post_view(UUID) TO anon, authenticated;

-- Focus time is added in the database, not read-modify-written by the client:
-- a session finishing while another tab holds a stale task row would otherwise
-- overwrite the other session's minutes.
CREATE OR REPLACE FUNCTION add_task_time(target_task_id UUID, minutes INT)
RETURNS void AS $$
BEGIN
  IF minutes IS NULL OR minutes <= 0 THEN RETURN; END IF;
  UPDATE tasks SET tracked_minutes = LEAST(COALESCE(tracked_minutes, 0) + minutes, 100000)
  WHERE id = target_task_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Habit logging. One round trip and idempotent: incrementing from the today
-- view fires once per tap, and a select-then-insert would double-count a race.
CREATE OR REPLACE FUNCTION set_habit_log(target_habit_id UUID, target_date DATE, new_value NUMERIC)
RETURNS void AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM habits WHERE id = target_habit_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Habit not found';
  END IF;
  IF new_value IS NULL OR new_value <= 0 THEN
    DELETE FROM habit_logs WHERE habit_id = target_habit_id AND completed_date = target_date;
    RETURN;
  END IF;
  INSERT INTO habit_logs (habit_id, completed_date, value)
  VALUES (target_habit_id, target_date, LEAST(new_value, 100000))
  ON CONFLICT (habit_id, completed_date) DO UPDATE SET value = LEAST(EXCLUDED.value, 100000);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

CREATE OR REPLACE FUNCTION update_habit_order(habit_ids UUID[])
RETURNS void AS $$
BEGIN
  FOR i IN 1..array_length(habit_ids, 1) LOOP
    UPDATE habits SET display_order = i WHERE id = habit_ids[i] AND user_id = auth.uid();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Spaced review. The schedule is computed here so a review and the topic
-- state it produces can never disagree: the client sends a rating, not an
-- interval.
CREATE OR REPLACE FUNCTION record_learning_review(
  target_topic_id UUID,
  new_rating TEXT
)
RETURNS learning_topics AS $$
DECLARE
  t learning_topics;
  next_ease NUMERIC;
  next_interval INT;
  next_lapses INT;
BEGIN
  SELECT * INTO t FROM learning_topics
  WHERE id = target_topic_id AND user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Topic not found'; END IF;

  next_ease := t.ease;
  next_lapses := t.lapses;

  IF new_rating = 'again' THEN
    -- Back to tomorrow, and the topic is marked as harder than assumed.
    next_ease := GREATEST(1.3, t.ease - 0.2);
    next_interval := 1;
    next_lapses := t.lapses + 1;
  ELSIF new_rating = 'hard' THEN
    next_ease := GREATEST(1.3, t.ease - 0.15);
    next_interval := GREATEST(1, CEIL(GREATEST(t.interval_days, 1) * 1.2)::INT);
  ELSIF new_rating = 'good' THEN
    next_interval := CASE
      WHEN t.interval_days = 0 THEN 1
      WHEN t.interval_days = 1 THEN 3
      ELSE CEIL(t.interval_days * t.ease)::INT
    END;
  ELSIF new_rating = 'easy' THEN
    next_ease := LEAST(3.5, t.ease + 0.15);
    next_interval := CASE
      WHEN t.interval_days = 0 THEN 4
      ELSE CEIL(GREATEST(t.interval_days, 1) * t.ease * 1.3)::INT
    END;
  ELSE
    RAISE EXCEPTION 'Unknown rating %', new_rating;
  END IF;

  next_interval := LEAST(next_interval, 3650);

  INSERT INTO learning_reviews
    (topic_id, rating, interval_before, interval_after, ease_after)
  VALUES
    (target_topic_id, new_rating, t.interval_days, next_interval, next_ease);

  UPDATE learning_topics SET
    ease = next_ease,
    interval_days = next_interval,
    lapses = next_lapses,
    review_count = t.review_count + 1,
    last_reviewed_at = now(),
    due_date = (CURRENT_DATE + next_interval)::DATE
  WHERE id = target_topic_id
  RETURNING * INTO t;

  RETURN t;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- Task Reordering
CREATE OR REPLACE FUNCTION update_task_order(task_ids UUID[])
RETURNS void AS $$
BEGIN
  FOR i IN 1..array_length(task_ids, 1) LOOP
    UPDATE tasks SET display_order = i WHERE id = task_ids[i] AND user_id = auth.uid();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- A dependency cycle makes "is this task blocked?" non-terminating, so it is
-- rejected by the database rather than only by the client.
CREATE OR REPLACE FUNCTION reject_dependency_cycle()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE chain(id) AS (
      SELECT NEW.depends_on_id
      UNION
      SELECT d.depends_on_id FROM task_dependencies d JOIN chain c ON d.task_id = c.id
    )
    SELECT 1 FROM chain WHERE id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'Dependency would create a cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_dependencies_no_cycle ON task_dependencies;
CREATE TRIGGER task_dependencies_no_cycle BEFORE INSERT OR UPDATE ON task_dependencies FOR EACH ROW EXECUTE FUNCTION reject_dependency_cycle();

-- Completion time is set in one place so every write path agrees, including
-- drag-to-column on the board and bulk status changes.
CREATE OR REPLACE FUNCTION sync_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_sync_completed_at ON tasks;
CREATE TRIGGER tasks_sync_completed_at BEFORE INSERT OR UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION sync_task_completed_at();

-- Section Reordering
CREATE OR REPLACE FUNCTION update_section_order(section_ids UUID[])
RETURNS void AS $$
BEGIN
  FOR i IN 1..array_length(section_ids, 1) LOOP
    UPDATE portfolio_sections SET display_order = i WHERE id = section_ids[i];
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Items within one section, the same way. Invoker rights, so
-- row-level security on portfolio_items still decides who may write.
CREATE OR REPLACE FUNCTION public.update_item_order(section_uuid UUID, item_ids UUID[])
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  FOR i IN 1..coalesce(array_length(item_ids, 1), 0) LOOP
    UPDATE portfolio_items
       SET display_order = i
     WHERE id = item_ids[i]
       AND section_id = section_uuid;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_item_order(UUID, UUID[]) TO authenticated;

-- Asset Usage Tracker
CREATE OR REPLACE FUNCTION update_asset_usage()
RETURNS void AS $$
DECLARE asset RECORD; usage JSONB;
BEGIN
  FOR asset IN SELECT id, file_path FROM storage_assets LOOP
    usage := '[]'::jsonb;
    IF EXISTS (SELECT 1 FROM blog_posts WHERE cover_image_url LIKE '%' || asset.file_path || '%') THEN
      usage := usage || jsonb_build_object('type', 'Blog Cover', 'id', (SELECT id FROM blog_posts WHERE cover_image_url LIKE '%' || asset.file_path || '%' LIMIT 1));
    END IF;
    IF EXISTS (SELECT 1 FROM blog_posts WHERE content LIKE '%' || asset.file_path || '%') THEN
      usage := usage || jsonb_build_object('type', 'Blog Content', 'id', (SELECT id FROM blog_posts WHERE content LIKE '%' || asset.file_path || '%' LIMIT 1));
    END IF;
    IF EXISTS (SELECT 1 FROM portfolio_items WHERE image_url LIKE '%' || asset.file_path || '%') THEN
      usage := usage || jsonb_build_object('type', 'Portfolio Item', 'id', (SELECT id FROM portfolio_items WHERE image_url LIKE '%' || asset.file_path || '%' LIMIT 1));
    END IF;
    UPDATE storage_assets SET used_in = usage WHERE id = asset.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- 12. STORAGE BUCKET & POLICIES
-- =========================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read access assets" ON storage.objects;
CREATE POLICY "Public read access assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets');

DROP POLICY IF EXISTS "Admin upload access assets" ON storage.objects;
CREATE POLICY "Admin upload access assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admin update access assets" ON storage.objects;
CREATE POLICY "Admin update access assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admin delete access assets" ON storage.objects;
CREATE POLICY "Admin delete access assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'assets' AND public.is_admin());


-- =========================================================
-- 13. SEED DATA
-- =========================================================

-- Site Identity (required for the portfolio to render on first load)
INSERT INTO site_identity (id, profile_data, social_links, footer_data, portfolio_mode)
VALUES (1,
  '{
    "name": "Your Name",
    "title": "Your Professional Title",
    "description": "A brief, compelling description about who you are and what you do. This will appear on your homepage.",
    "profile_picture_url": "",
    "show_profile_picture": false,
    "default_theme": "theme-field-notes-light",
    "logo": { "main": "YOUR", "highlight": ".DEV" },
    "status_panel": {
      "show": true,
      "design": "minimal",
      "title": "status.panel",
      "availability": "Open for new opportunities",
      "currently_exploring": { "title": "Exploring", "items": ["New Tech 1", "New Tech 2"] },
      "latestProject": { "name": "My Latest Project", "linkText": "View all work", "href": "/work" }
    },
    "bio": [
      "This is the first paragraph of your bio on the About page. Share your story, your passion for your work, and what drives you.",
      "This is the second paragraph. You can talk about your philosophy, interests outside of work, or your long-term goals."
    ],
    "github_projects_config": {
      "username": "your-github-username",
      "show": true,
      "sort_by": "pushed",
      "exclude_forks": true,
      "exclude_archived": true,
      "exclude_profile_repo": true,
      "min_stars": 0,
      "projects_per_page": 9
    },
    "contact_page": {
      "show_contact_form": true,
      "show_availability_badge": true,
      "show_services": true
    }
  }',
  '[
    {"id": "github", "label": "GitHub", "url": "https://github.com/your-username", "is_visible": true},
    {"id": "linkedin", "label": "LinkedIn", "url": "https://linkedin.com/in/your-profile", "is_visible": true},
    {"id": "email", "label": "Email", "url": "mailto:your-email@example.com", "is_visible": true}
  ]',
  '{ "copyright_text": "Crafted with Next.js & Supabase. Deployed on GitHub Pages." }',
  'multi-page'
) ON CONFLICT (id) DO NOTHING;

-- Security Settings (default: no lockdown)
INSERT INTO security_settings (id, lockdown_level) VALUES (1, 0) ON CONFLICT DO NOTHING;
INSERT INTO integration_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Default Navigation Links, led by the work. The /contact link renders
-- as the header's call to action; Updates lives in the footer.
--
-- Seeded only into an empty table. navigation_links has no natural key, so
-- the old ON CONFLICT DO NOTHING never fired: every re-run of this file added
-- the whole default nav again, and re-running is how an existing project
-- applies schema changes.
INSERT INTO navigation_links (label, href, display_order, is_visible)
SELECT v.label, v.href, v.display_order, true
  FROM (VALUES
    ('Work',         '/work',    0),
    ('About',        '/about',   1),
    ('Writing',      '/blog',    2),
    ('Work with me', '/contact', 3)
  ) AS v(label, href, display_order)
 WHERE NOT EXISTS (SELECT 1 FROM navigation_links);


-- =========================================================
-- 12. DISCOVER
-- =========================================================
--
-- Two small tables behind a module that reads from public APIs. Nothing
-- fetched is stored: these rows are only *what to ask for*. Caching a forecast
-- would mean deciding when it goes stale, and a stale forecast is worse than
-- none.
--
-- Keyless services only. This app is a static export with no server, so any
-- API key would travel as NEXT_PUBLIC_* and be compiled into the JavaScript
-- bundle, readable by anyone who opens the page.

-- ── Places ──────────────────────────────────────────────────────────────────
--
-- Two is the interesting number: where you are, and where the people you left
-- behind are. The calendar already carries a home timezone for the same
-- reason.

CREATE TABLE IF NOT EXISTS discover_places (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  label      TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  -- Stored to four decimal places' worth of precision, which is about 11
  -- metres — far more than a forecast resolves to, and enough that the
  -- constraint is about validity rather than accuracy.
  latitude   NUMERIC(8,4) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude  NUMERIC(9,4) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- An IANA zone name, so the forecast can be read in the place's own clock
  -- rather than the viewer's.
  timezone   TEXT CHECK (char_length(coalesce(timezone,'')) <= 64),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE discover_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage discover places" ON discover_places;
CREATE POLICY "Admin manage discover places" ON discover_places FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

CREATE INDEX IF NOT EXISTS discover_places_user_idx
  ON discover_places (user_id, sort_order);

-- ── Topics ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discover_topics (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- What to search for. Sent verbatim as a query parameter, so it is bounded
  -- here as well as escaped at the call site.
  term       TEXT NOT NULL CHECK (char_length(term) BETWEEN 1 AND 80),
  -- Which service answers for this topic. A CHECK rather than an enum: adding
  -- a source should be a migration, not a type change across two schemas.
  source     TEXT NOT NULL DEFAULT 'hackernews'
             CHECK (source IN ('hackernews', 'devto')),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- The same term twice from the same source is two identical panels.
  CONSTRAINT discover_topics_unique UNIQUE (user_id, term, source)
);

ALTER TABLE discover_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage discover topics" ON discover_topics;
CREATE POLICY "Admin manage discover topics" ON discover_topics FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

CREATE INDEX IF NOT EXISTS discover_topics_user_idx
  ON discover_topics (user_id, sort_order);

-- =========================================================
-- LIBRARY — what you read and watch, and the lines worth keeping
-- =========================================================
-- Neither table has a public read policy; visitors reach one random public
-- highlight through get_random_public_highlight() and nothing else.

CREATE TABLE IF NOT EXISTS library_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- CHECK rather than an enum: adding a kind should be a migration, not a type
  -- change across two schemas. Same reasoning as `discover_topics.source`.
  kind TEXT NOT NULL DEFAULT 'book'
    CHECK (kind IN ('book', 'article', 'video', 'podcast', 'other')),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  -- Author, channel or host. One column for all of them: the reader asks
  -- "who made this", and splitting it by kind would be three nullable columns
  -- answering the same question.
  creator TEXT CHECK (creator IS NULL OR char_length(creator) <= 200),
  url TEXT CHECK (url IS NULL OR char_length(url) <= 2048),
  status TEXT NOT NULL DEFAULT 'want'
    CHECK (status IN ('want', 'in_progress', 'done', 'abandoned')),
  rating INT2 CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  started_on DATE,
  finished_on DATE,
  -- Finishing before starting is a typo, and it would make any "how long did
  -- this take" figure negative.
  CONSTRAINT library_sources_dates_ordered
    CHECK (finished_on IS NULL OR started_on IS NULL OR finished_on >= started_on),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_sources_status_idx
  ON library_sources (user_id, status, updated_at DESC);

ALTER TABLE library_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage library sources" ON library_sources;
CREATE POLICY "Admin manage library sources" ON library_sources FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

DROP TRIGGER IF EXISTS update_library_sources_updated_at ON library_sources;
CREATE TRIGGER update_library_sources_updated_at
  BEFORE UPDATE ON library_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Highlights
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS library_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- ON DELETE SET NULL, not CASCADE: deleting a source must not take the
  -- lines you kept from it. The admin names how many will lose their source
  -- before it lets you delete one.
  source_id UUID REFERENCES library_sources(id) ON DELETE SET NULL,
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  -- For a line with no source record — something heard once, or a quote you
  -- only know the speaker of.
  attribution TEXT CHECK (attribution IS NULL OR char_length(attribution) <= 200),
  -- "p. 42", "ch. 3", "12:34". Free text because a Kindle location, a page
  -- and a timestamp are all legitimate and none of them is a number.
  location TEXT CHECK (location IS NULL OR char_length(location) <= 50),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  is_public BOOLEAN NOT NULL DEFAULT false,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_highlights_source_idx
  ON library_highlights (source_id);

-- Matches the one query a visitor can cause, and is tiny because most rows are
-- private.
CREATE INDEX IF NOT EXISTS library_highlights_public_idx
  ON library_highlights (id)
  WHERE is_public;

ALTER TABLE library_highlights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage library highlights" ON library_highlights;
CREATE POLICY "Admin manage library highlights" ON library_highlights FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

DROP TRIGGER IF EXISTS update_library_highlights_updated_at ON library_highlights;
CREATE TRIGGER update_library_highlights_updated_at
  BEFORE UPDATE ON library_highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- The one thing a visitor can read
-- ----------------------------------------------------------------------------
--
-- SECURITY DEFINER because visitors have no policy on either table. It is
-- listed in `db-security.test.ts` as deliberately not requiring AAL2 — a
-- signed-out visitor is the intended caller — and it is safe to expose for the
-- same reason: it returns only rows the owner marked public, and only the
-- columns a citation needs.
--
-- VOLATILE because of random(): each call must make its own pick, and a
-- STABLE declaration would license the planner to reuse one answer.
CREATE OR REPLACE FUNCTION public.get_random_public_highlight()
RETURNS TABLE (
  id UUID,
  text TEXT,
  attribution TEXT,
  location TEXT,
  source_title TEXT,
  source_creator TEXT,
  source_kind TEXT,
  source_url TEXT
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT h.id, h.text, h.attribution, h.location,
         s.title, s.creator, s.kind, s.url
    FROM library_highlights h
    LEFT JOIN library_sources s ON s.id = h.source_id
   WHERE h.is_public
   ORDER BY random()
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_random_public_highlight() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_random_public_highlight() TO anon, authenticated;

-- ============================================================================
-- MONEY
-- ============================================================================
--
-- A personal ledger for someone whose money lives in two countries. The design
-- rules, each enforced here rather than hoped for in the app:
--
-- * Money is BIGINT minor units (1234 = $12.34, ₹12.34). A rate is NUMERIC;
--   only amounts are integers. `money_currency.exponent` says what an integer
--   means — the yen has no minor unit and the Kuwaiti dinar has three.
-- * Double entry. A transaction is a header; postings say what moved where.
--   An expense is one or more postings on one account (several = a split). A
--   transfer is two or more legs across accounts that balance when they share
--   a currency; a cross-currency transfer carries both real amounts, and the
--   gap between them and the mid-market rate is what the transfer cost.
-- * Sign is direction. A posting's amount is what happened to the account:
--   negative leaves, positive arrives. Liabilities (cards, loans) therefore
--   hold negative balances — "you own −$420" is "you owe $420".
-- * Balances are derived, never stored: opening anchor + postings.
-- * An exchange rate is frozen onto each posting when it is written, so last
--   February's report says what last February cost.


-- ── Currencies ──────────────────────────────────────────────────────────────
-- `src/features/money/domain/money.ts` mirrors the exponents.

CREATE TABLE IF NOT EXISTS money_currency (
  code     CHAR(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),
  exponent SMALLINT NOT NULL CHECK (exponent BETWEEN 0 AND 4),
  name     TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  symbol   TEXT CHECK (symbol IS NULL OR char_length(symbol) <= 8)
);
ALTER TABLE money_currency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner reads currencies" ON money_currency;
CREATE POLICY "Owner reads currencies" ON money_currency FOR SELECT
  USING (public.is_aal2());
DROP POLICY IF EXISTS "Owner writes currencies" ON money_currency;
CREATE POLICY "Owner writes currencies" ON money_currency FOR ALL
  USING (public.is_aal2()) WITH CHECK (public.is_aal2());

INSERT INTO money_currency (code, exponent, name, symbol) VALUES
  ('CAD', 2, 'Canadian Dollar', '$'),     ('INR', 2, 'Indian Rupee', '₹'),
  ('USD', 2, 'US Dollar', 'US$'),         ('EUR', 2, 'Euro', '€'),
  ('GBP', 2, 'Pound Sterling', '£'),      ('AUD', 2, 'Australian Dollar', 'A$'),
  ('NZD', 2, 'New Zealand Dollar', 'NZ$'), ('AED', 2, 'UAE Dirham', 'AED'),
  ('SAR', 2, 'Saudi Riyal', 'SAR'),       ('QAR', 2, 'Qatari Riyal', 'QAR'),
  ('KWD', 3, 'Kuwaiti Dinar', 'KWD'),     ('BHD', 3, 'Bahraini Dinar', 'BHD'),
  ('OMR', 3, 'Omani Rial', 'OMR'),        ('SGD', 2, 'Singapore Dollar', 'S$'),
  ('HKD', 2, 'Hong Kong Dollar', 'HK$'),  ('JPY', 0, 'Japanese Yen', '¥'),
  ('KRW', 0, 'South Korean Won', '₩'),    ('CNY', 2, 'Chinese Yuan', 'CN¥'),
  ('CHF', 2, 'Swiss Franc', 'CHF'),       ('SEK', 2, 'Swedish Krona', 'kr'),
  ('NOK', 2, 'Norwegian Krone', 'kr'),    ('DKK', 2, 'Danish Krone', 'kr'),
  ('PLN', 2, 'Polish Zloty', 'zł'),       ('TRY', 2, 'Turkish Lira', '₺'),
  ('PKR', 2, 'Pakistani Rupee', 'Rs'),    ('BDT', 2, 'Bangladeshi Taka', '৳'),
  ('LKR', 2, 'Sri Lankan Rupee', 'Rs'),   ('NPR', 2, 'Nepalese Rupee', 'Rs'),
  ('PHP', 2, 'Philippine Peso', '₱'),     ('MYR', 2, 'Malaysian Ringgit', 'RM'),
  ('THB', 2, 'Thai Baht', '฿'),           ('IDR', 2, 'Indonesian Rupiah', 'Rp'),
  ('VND', 0, 'Vietnamese Dong', '₫'),     ('MXN', 2, 'Mexican Peso', 'MX$'),
  ('BRL', 2, 'Brazilian Real', 'R$'),     ('ZAR', 2, 'South African Rand', 'R'),
  ('NGN', 2, 'Nigerian Naira', '₦'),      ('KES', 2, 'Kenyan Shilling', 'KSh'),
  ('EGP', 2, 'Egyptian Pound', 'E£')
ON CONFLICT (code) DO UPDATE
  SET exponent = EXCLUDED.exponent, name = EXCLUDED.name, symbol = EXCLUDED.symbol;


-- ── Exchange rates ──────────────────────────────────────────────────────────
-- Units of `quote` per one `base`, on a day. Fetched by the app from a free
-- source, or typed in; the ledger freezes whichever applied onto a posting.

CREATE TABLE IF NOT EXISTS money_rate (
  base   CHAR(3) NOT NULL REFERENCES money_currency(code),
  quote  CHAR(3) NOT NULL REFERENCES money_currency(code),
  as_of  DATE    NOT NULL,
  rate   NUMERIC(24,12) NOT NULL CHECK (rate > 0),
  source TEXT CHECK (source IS NULL OR char_length(source) <= 60),
  PRIMARY KEY (base, quote, as_of),
  CONSTRAINT money_rate_distinct_pair CHECK (base <> quote)
);
CREATE INDEX IF NOT EXISTS money_rate_recent_idx ON money_rate (base, quote, as_of DESC);
ALTER TABLE money_rate ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages rates" ON money_rate;
CREATE POLICY "Owner manages rates" ON money_rate FOR ALL
  USING (public.is_aal2()) WITH CHECK (public.is_aal2());


-- ── Settings ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS money_settings (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- What every total is reported in.
  base_currency    CHAR(3) NOT NULL DEFAULT 'CAD' REFERENCES money_currency(code),
  -- The other side of the owner's life: remittance and net-worth views.
  home_currency    CHAR(3) NOT NULL DEFAULT 'INR' REFERENCES money_currency(code),
  province         CHAR(2) CHECK (province IS NULL OR province IN
                     ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT')),
  -- TFSA room accrues from the later of turning 18 and becoming resident.
  birth_year       INT CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100),
  resident_since   DATE,
  needs_pct        NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (needs_pct BETWEEN 0 AND 100),
  wants_pct        NUMERIC(5,2) NOT NULL DEFAULT 30 CHECK (wants_pct BETWEEN 0 AND 100),
  save_pct         NUMERIC(5,2) NOT NULL DEFAULT 20 CHECK (save_pct BETWEEN 0 AND 100),
  emergency_months NUMERIC(4,1) NOT NULL DEFAULT 6 CHECK (emergency_months BETWEEN 0 AND 36),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_settings_split_is_whole
    CHECK (needs_pct + wants_pct + save_pct = 100),
  CONSTRAINT money_settings_two_currencies
    CHECK (base_currency <> home_currency)
);
ALTER TABLE money_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages money settings" ON money_settings;
CREATE POLICY "Owner manages money settings" ON money_settings FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_settings_updated_at ON money_settings;
CREATE TRIGGER update_money_settings_updated_at BEFORE UPDATE ON money_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── Institutions ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS money_institution (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  country    CHAR(2) NOT NULL DEFAULT 'CA' CHECK (country ~ '^[A-Z]{2}$'),
  notes      TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
ALTER TABLE money_institution ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages institutions" ON money_institution;
CREATE POLICY "Owner manages institutions" ON money_institution FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_institution_updated_at ON money_institution;
CREATE TRIGGER update_money_institution_updated_at BEFORE UPDATE ON money_institution
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── Accounts ────────────────────────────────────────────────────────────────
--
-- The opening pair is the reconciliation anchor: "on opening_date this
-- account really held opening_balance_minor". Everything later is postings.
--
-- `registration` is what the tax system thinks the account is. Canadian
-- shelters (TFSA, RRSP, FHSA, RESP, RRIF, LIRA) only exist in Canada, Indian
-- non-resident accounts (NRE, NRO, FCNR) and schemes (PPF, EPF) only in India
-- — the checks say so, because a TFSA at an Indian bank would feed a wrong
-- number into contribution room and the T1135 check.

DO $$ BEGIN
  CREATE TYPE money_account_kind AS ENUM (
    'chequing','savings','credit_card','line_of_credit','cash',
    'investment','loan','mortgage','asset','wallet');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE money_registration AS ENUM (
    'none','tfsa','rrsp','fhsa','resp','rrif','lira','nre','nro','fcnr','ppf','epf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_account (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  institution_id UUID REFERENCES money_institution(id) ON DELETE SET NULL,
  name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  kind           money_account_kind NOT NULL DEFAULT 'chequing',
  registration   money_registration NOT NULL DEFAULT 'none',
  country        CHAR(2) NOT NULL DEFAULT 'CA' CHECK (country ~ '^[A-Z]{2}$'),
  currency       CHAR(3) NOT NULL REFERENCES money_currency(code),

  opening_balance_minor BIGINT NOT NULL DEFAULT 0,
  opening_date          DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Cards and lines of credit.
  credit_limit_minor BIGINT CHECK (credit_limit_minor IS NULL OR credit_limit_minor > 0),
  statement_day      SMALLINT CHECK (statement_day IS NULL OR statement_day BETWEEN 1 AND 31),
  payment_due_day    SMALLINT CHECK (payment_due_day IS NULL OR payment_due_day BETWEEN 1 AND 31),
  -- Annual %: a card's purchase APR, a LOC's rate, a savings account's yield.
  interest_rate      NUMERIC(6,3) CHECK (interest_rate IS NULL OR interest_rate BETWEEN 0 AND 100),

  -- Spendable within days: counted in cash-on-hand and the forecast.
  is_liquid    BOOLEAN NOT NULL DEFAULT true,
  in_net_worth BOOLEAN NOT NULL DEFAULT true,
  -- Last characters of the account number, to route rows in a bank export.
  import_ref   TEXT CHECK (import_ref IS NULL OR import_ref ~ '^[0-9A-Za-z]{2,8}$'),
  color        TEXT CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$'),
  notes        TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  sort_order   INT NOT NULL DEFAULT 0,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT money_account_credit_fields CHECK (
    kind IN ('credit_card','line_of_credit')
    OR (credit_limit_minor IS NULL AND statement_day IS NULL AND payment_due_day IS NULL)
  ),
  CONSTRAINT money_account_registration_country CHECK (
    registration = 'none'
    OR (registration IN ('tfsa','rrsp','fhsa','resp','rrif','lira') AND country = 'CA')
    OR (registration IN ('nre','nro','fcnr','ppf','epf') AND country = 'IN')
  ),
  CONSTRAINT money_account_registration_kind CHECK (
    registration = 'none' OR kind IN ('chequing','savings','investment','cash')
  )
);
CREATE INDEX IF NOT EXISTS money_account_user_idx
  ON money_account (user_id, sort_order) WHERE archived_at IS NULL;
ALTER TABLE money_account ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages accounts" ON money_account;
CREATE POLICY "Owner manages accounts" ON money_account FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_account_updated_at ON money_account;
CREATE TRIGGER update_money_account_updated_at BEFORE UPDATE ON money_account
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── Categories ──────────────────────────────────────────────────────────────
--
-- Two levels at most (Food › Groceries). `bucket` is the 50/30/20 shape of a
-- category; `is_essential` is the runway sense — still payable if income
-- stopped tomorrow — which is a different question.

DO $$ BEGIN
  CREATE TYPE money_bucket AS ENUM ('income','need','want','save');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_category (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  parent_id    UUID REFERENCES money_category(id) ON DELETE CASCADE,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  bucket       money_bucket NOT NULL DEFAULT 'want',
  is_essential BOOLEAN NOT NULL DEFAULT false,
  icon         TEXT CHECK (icon IS NULL OR char_length(icon) <= 40),
  color        TEXT CHECK (color IS NULL OR color ~* '^#[0-9a-f]{6}$'),
  sort_order   INT NOT NULL DEFAULT 0,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_category_not_own_parent CHECK (parent_id IS DISTINCT FROM id)
);
CREATE UNIQUE INDEX IF NOT EXISTS money_category_name_key
  ON money_category (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
ALTER TABLE money_category ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages categories" ON money_category;
CREATE POLICY "Owner manages categories" ON money_category FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_category_updated_at ON money_category;
CREATE TRIGGER update_money_category_updated_at BEFORE UPDATE ON money_category
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A child's parent is a top-level category of the same owner, and a child
-- shares its parent's bucket (Food › Restaurants cannot be a need while Food
-- is a want: the 50/30/20 split would count it twice).
CREATE OR REPLACE FUNCTION public.money_check_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent money_category%ROWTYPE;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_parent FROM money_category WHERE id = NEW.parent_id;
  IF v_parent.id IS NULL OR v_parent.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Parent category not found';
  END IF;
  IF v_parent.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Categories go two levels deep at most';
  END IF;
  IF EXISTS (SELECT 1 FROM money_category WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'A category with subcategories cannot itself be a subcategory';
  END IF;
  NEW.bucket := v_parent.bucket;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_category_shape ON money_category;
CREATE TRIGGER money_category_shape BEFORE INSERT OR UPDATE ON money_category
  FOR EACH ROW EXECUTE FUNCTION public.money_check_category();

-- Re-bucketing a parent carries its children with it. AFTER, not in the
-- trigger above: the children's own trigger copies the parent's bucket, and
-- before the parent row is written that would still be the old one.
CREATE OR REPLACE FUNCTION public.money_rebucket_children()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE money_category SET bucket = NEW.bucket
   WHERE parent_id = NEW.id AND bucket IS DISTINCT FROM NEW.bucket;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS money_category_rebucket ON money_category;
CREATE TRIGGER money_category_rebucket AFTER UPDATE OF bucket ON money_category
  FOR EACH ROW WHEN (NEW.parent_id IS NULL AND NEW.bucket IS DISTINCT FROM OLD.bucket)
  EXECUTE FUNCTION public.money_rebucket_children();


-- ── Import batches ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS money_import_batch (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  account_id      UUID NOT NULL REFERENCES money_account(id) ON DELETE CASCADE,
  file_name       TEXT CHECK (file_name IS NULL OR char_length(file_name) <= 200),
  preset          TEXT CHECK (preset IS NULL OR char_length(preset) <= 40),
  row_count       INT NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  imported_count  INT NOT NULL DEFAULT 0 CHECK (imported_count >= 0),
  duplicate_count INT NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE money_import_batch ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages import batches" ON money_import_batch;
CREATE POLICY "Owner manages import batches" ON money_import_batch FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());


-- ── Transactions and postings ───────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE money_transaction_kind AS ENUM
    ('expense','income','refund','transfer','adjustment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE money_transaction_status AS ENUM ('pending','cleared','reconciled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_transaction (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  -- When it hit the account.
  date            DATE NOT NULL,
  kind            money_transaction_kind NOT NULL,
  status          money_transaction_status NOT NULL DEFAULT 'cleared',
  description     TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 200),
  payee           TEXT CHECK (payee IS NULL OR char_length(payee) <= 200),
  notes           TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  -- The bank's own wording, kept verbatim for rules and dedupe.
  raw_description TEXT CHECK (raw_description IS NULL OR char_length(raw_description) <= 500),

  -- The recurring schedule this satisfied, and which due date. The FK is
  -- added with `money_schedule`.
  schedule_id     UUID,
  occurrence_date DATE,

  import_hash     TEXT CHECK (import_hash IS NULL OR char_length(import_hash) <= 64),
  import_batch_id UUID REFERENCES money_import_batch(id) ON DELETE SET NULL,

  -- Cross-currency transfers: who moved it, and the mid-market rate (units of
  -- the arriving currency per one leaving) at the time. With both legs'
  -- real amounts, that is enough to say what the transfer cost.
  provider        TEXT CHECK (provider IS NULL OR char_length(provider) <= 80),
  market_rate     NUMERIC(24,12) CHECK (market_rate IS NULL OR market_rate > 0),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT money_transaction_occurrence_pair
    CHECK ((schedule_id IS NULL) = (occurrence_date IS NULL)),
  CONSTRAINT money_transaction_market_rate_on_transfer
    CHECK (market_rate IS NULL OR kind = 'transfer')
);
CREATE INDEX IF NOT EXISTS money_transaction_user_date_idx
  ON money_transaction (user_id, date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS money_transaction_import_hash_key
  ON money_transaction (user_id, import_hash) WHERE import_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS money_transaction_occurrence_key
  ON money_transaction (schedule_id, occurrence_date) WHERE schedule_id IS NOT NULL;
ALTER TABLE money_transaction ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages transactions" ON money_transaction;
CREATE POLICY "Owner manages transactions" ON money_transaction FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_transaction_updated_at ON money_transaction;
CREATE TRIGGER update_money_transaction_updated_at BEFORE UPDATE ON money_transaction
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$ BEGIN
  ALTER TABLE inventory_items
    ADD CONSTRAINT inventory_items_transaction_fkey
    FOREIGN KEY (transaction_id) REFERENCES money_transaction(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_posting (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  transaction_id    UUID NOT NULL REFERENCES money_transaction(id) ON DELETE CASCADE,
  -- RESTRICT: an account with history is archived, not deleted. Deleting it
  -- would orphan one leg of every transfer it took part in.
  account_id        UUID NOT NULL REFERENCES money_account(id) ON DELETE RESTRICT,
  category_id       UUID REFERENCES money_category(id) ON DELETE SET NULL,
  -- Signed minor units of the account's currency. Zero moves nothing.
  amount_minor      BIGINT NOT NULL CHECK (amount_minor <> 0),
  currency          CHAR(3) NOT NULL REFERENCES money_currency(code),
  memo              TEXT CHECK (memo IS NULL OR char_length(memo) <= 200),
  -- Frozen when written. Both null means no rate was known: the posting is
  -- reported as unpriced, never guessed at parity.
  fx_rate           NUMERIC(24,12) CHECK (fx_rate IS NULL OR fx_rate > 0),
  base_amount_minor BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_posting_priced_together
    CHECK ((fx_rate IS NULL) = (base_amount_minor IS NULL))
);
CREATE INDEX IF NOT EXISTS money_posting_transaction_idx ON money_posting (transaction_id);
CREATE INDEX IF NOT EXISTS money_posting_account_idx ON money_posting (account_id);
CREATE INDEX IF NOT EXISTS money_posting_category_idx ON money_posting (category_id);
ALTER TABLE money_posting ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages postings" ON money_posting;
CREATE POLICY "Owner manages postings" ON money_posting FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

-- Per row, before write: the posting is in its account's currency, belongs to
-- the account's owner, and a base-currency posting is priced at 1 without
-- the app having to say so.
CREATE OR REPLACE FUNCTION public.money_prepare_posting()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account money_account%ROWTYPE;
  v_base    CHAR(3);
BEGIN
  SELECT * INTO v_account FROM money_account WHERE id = NEW.account_id;
  IF v_account.id IS NULL OR v_account.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  IF NEW.currency IS NULL THEN
    NEW.currency := v_account.currency;
  ELSIF NEW.currency <> v_account.currency THEN
    RAISE EXCEPTION 'A % posting cannot go on a % account', NEW.currency, v_account.currency;
  END IF;
  IF NEW.category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM money_category WHERE id = NEW.category_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  SELECT base_currency INTO v_base FROM money_settings WHERE user_id = NEW.user_id;
  IF NEW.currency = coalesce(v_base, 'CAD') THEN
    NEW.fx_rate := 1;
    NEW.base_amount_minor := NEW.amount_minor;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_posting_prepare ON money_posting;
CREATE TRIGGER money_posting_prepare BEFORE INSERT OR UPDATE ON money_posting
  FOR EACH ROW EXECUTE FUNCTION public.money_prepare_posting();

-- At COMMIT: the postings of a transaction make sense for its kind. Deferred
-- because a transaction's postings are written one row at a time.
--
--   expense      one account, net out   (several postings = a split)
--   income       one account, net in
--   refund       one account, net in    (a purchase coming back; its category
--                                         reduces that category's spend)
--   adjustment   exactly one uncategorised posting (a balance correction)
--   transfer     uncategorised legs across ≥2 accounts, money leaving and
--                arriving; legs in one currency sum to zero. Categorised
--                postings on a transfer are its fees, and fees only leave.
--
-- And for every kind: no posting before its account's opening date, which
-- is the anchor its balance is measured from.
CREATE OR REPLACE FUNCTION public.money_check_transaction(p_transaction UUID)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kind        money_transaction_kind;
  v_date        DATE;
  v_count       INT;
  v_accounts    INT;
  v_net         BIGINT;
  v_legs        INT;
  v_leg_accounts INT;
  v_leg_currencies INT;
  v_leg_net     BIGINT;
  v_leg_in      INT;
  v_leg_out     INT;
  v_fee_in      INT;
  v_uncategorised INT;
BEGIN
  SELECT kind, date INTO v_kind, v_date FROM money_transaction WHERE id = p_transaction;
  IF v_kind IS NULL THEN
    RETURN; -- the transaction itself was deleted
  END IF;

  SELECT count(*),
         count(DISTINCT account_id),
         coalesce(sum(amount_minor), 0),
         count(*) FILTER (WHERE category_id IS NULL),
         count(DISTINCT account_id) FILTER (WHERE category_id IS NULL),
         count(DISTINCT currency) FILTER (WHERE category_id IS NULL),
         coalesce(sum(amount_minor) FILTER (WHERE category_id IS NULL), 0),
         count(*) FILTER (WHERE category_id IS NULL AND amount_minor > 0),
         count(*) FILTER (WHERE category_id IS NULL AND amount_minor < 0),
         count(*) FILTER (WHERE category_id IS NOT NULL AND amount_minor > 0)
    INTO v_count, v_accounts, v_net, v_legs, v_leg_accounts, v_leg_currencies,
         v_leg_net, v_leg_in, v_leg_out, v_fee_in
    FROM money_posting WHERE transaction_id = p_transaction;
  v_uncategorised := v_legs;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'A transaction needs at least one posting';
  END IF;

  IF EXISTS (
    SELECT 1 FROM money_posting p JOIN money_account a ON a.id = p.account_id
     WHERE p.transaction_id = p_transaction AND v_date < a.opening_date
  ) THEN
    RAISE EXCEPTION 'A transaction cannot be dated before its account was opened';
  END IF;

  CASE v_kind
    WHEN 'expense' THEN
      IF v_accounts <> 1 THEN RAISE EXCEPTION 'An expense comes out of one account'; END IF;
      IF v_net >= 0 THEN RAISE EXCEPTION 'An expense has to take money out'; END IF;
    WHEN 'income' THEN
      IF v_accounts <> 1 THEN RAISE EXCEPTION 'Income arrives in one account'; END IF;
      IF v_net <= 0 THEN RAISE EXCEPTION 'Income has to bring money in'; END IF;
    WHEN 'refund' THEN
      IF v_accounts <> 1 THEN RAISE EXCEPTION 'A refund arrives in one account'; END IF;
      IF v_net <= 0 THEN RAISE EXCEPTION 'A refund has to bring money in'; END IF;
    WHEN 'adjustment' THEN
      IF v_count <> 1 OR v_uncategorised <> 1 THEN
        RAISE EXCEPTION 'An adjustment is one uncategorised posting';
      END IF;
    WHEN 'transfer' THEN
      IF v_legs < 2 OR v_leg_accounts < 2 THEN
        RAISE EXCEPTION 'A transfer moves money between two different accounts';
      END IF;
      IF v_leg_in = 0 OR v_leg_out = 0 THEN
        RAISE EXCEPTION 'A transfer needs money leaving one account and arriving in another';
      END IF;
      IF v_leg_currencies = 1 AND v_leg_net <> 0 THEN
        RAISE EXCEPTION 'A transfer in one currency must balance; it is off by % minor units', v_leg_net;
      END IF;
      IF v_fee_in > 0 THEN
        RAISE EXCEPTION 'A transfer fee takes money out';
      END IF;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.money_check_posting_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    PERFORM public.money_check_transaction(OLD.transaction_id);
  END IF;
  IF TG_OP IN ('INSERT','UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.transaction_id <> OLD.transaction_id) THEN
    PERFORM public.money_check_transaction(NEW.transaction_id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS money_posting_balanced ON money_posting;
CREATE CONSTRAINT TRIGGER money_posting_balanced
  AFTER INSERT OR UPDATE OR DELETE ON money_posting
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.money_check_posting_trigger();

-- A change of kind or date can break a transaction whose postings did not
-- change, so the header is checked too.
CREATE OR REPLACE FUNCTION public.money_check_transaction_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.money_check_transaction(NEW.id);
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS money_transaction_consistent ON money_transaction;
CREATE CONSTRAINT TRIGGER money_transaction_consistent
  AFTER INSERT OR UPDATE OF kind, date ON money_transaction
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.money_check_transaction_trigger();

-- An account's opening date cannot move past history it already has.
CREATE OR REPLACE FUNCTION public.money_check_account_opening()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.currency <> OLD.currency AND EXISTS (
    SELECT 1 FROM money_posting WHERE account_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'An account with transactions cannot change currency';
  END IF;
  IF NEW.opening_date > OLD.opening_date AND EXISTS (
    SELECT 1 FROM money_posting p JOIN money_transaction t ON t.id = p.transaction_id
     WHERE p.account_id = NEW.id AND t.date < NEW.opening_date
  ) THEN
    RAISE EXCEPTION 'The account has transactions before %', NEW.opening_date;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_account_history ON money_account;
CREATE TRIGGER money_account_history BEFORE UPDATE OF currency, opening_date ON money_account
  FOR EACH ROW EXECUTE FUNCTION public.money_check_account_opening();


-- ── Reconciliation checkpoints ──────────────────────────────────────────────
-- "On this date the statement said this." The app compares it with the
-- derived balance and shows the gap; nothing is forced to agree.

CREATE TABLE IF NOT EXISTS money_reconciliation (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  account_id              UUID NOT NULL REFERENCES money_account(id) ON DELETE CASCADE,
  as_of                   DATE NOT NULL,
  statement_balance_minor BIGINT NOT NULL,
  note                    TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, as_of)
);
ALTER TABLE money_reconciliation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages reconciliations" ON money_reconciliation;
CREATE POLICY "Owner manages reconciliations" ON money_reconciliation FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());


-- ── Categorisation rules ────────────────────────────────────────────────────
-- Applied by the app on import and entry, highest priority first. Patterns
-- are matched case-insensitively; 'regex' is validated here so a bad pattern
-- is refused on save rather than failing every import after it.

DO $$ BEGIN
  CREATE TYPE money_rule_match AS ENUM ('contains','starts_with','equals','regex');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_rule (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  priority    INT NOT NULL DEFAULT 100,
  match       money_rule_match NOT NULL DEFAULT 'contains',
  pattern     TEXT NOT NULL CHECK (char_length(pattern) BETWEEN 1 AND 200),
  -- Only rows from this account, when set.
  account_id  UUID REFERENCES money_account(id) ON DELETE CASCADE,
  category_id UUID REFERENCES money_category(id) ON DELETE CASCADE,
  payee       TEXT CHECK (payee IS NULL OR char_length(payee) <= 200),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_rule_does_something CHECK (category_id IS NOT NULL OR payee IS NOT NULL)
);
ALTER TABLE money_rule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages rules" ON money_rule;
CREATE POLICY "Owner manages rules" ON money_rule FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_rule_updated_at ON money_rule;
CREATE TRIGGER update_money_rule_updated_at BEFORE UPDATE ON money_rule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION public.money_check_rule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.match = 'regex' THEN
    BEGIN
      PERFORM '' ~* NEW.pattern;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Not a valid pattern: %', NEW.pattern;
    END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_rule_valid ON money_rule;
CREATE TRIGGER money_rule_valid BEFORE INSERT OR UPDATE ON money_rule
  FOR EACH ROW EXECUTE FUNCTION public.money_check_rule();


-- ── Writing a transaction ───────────────────────────────────────────────────
--
-- Header and postings in one call, so there is no moment where a transfer
-- has one leg. Editing replaces the postings wholesale — patching legs one
-- at a time would pass through states the check above refuses.
--
-- p_transaction: { date, kind, status?, description, payee?, notes?,
--                  raw_description?, schedule_id?, occurrence_date?,
--                  import_hash?, import_batch_id?, provider?, market_rate? }
-- p_postings:    [{ account_id, category_id?, amount_minor, memo?,
--                   fx_rate?, base_amount_minor? }, …]   (1–50)

CREATE OR REPLACE FUNCTION public.money_write_postings(
  p_uid UUID,
  p_transaction UUID,
  p_postings JSONB
)
RETURNS void
LANGUAGE plpgsql
-- Invoker, not definer: only the write RPCs below call it (EXECUTE is
-- revoked from everyone else), and inside them it already runs with their
-- rights.
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_posting JSONB;
BEGIN
  IF p_postings IS NULL OR jsonb_typeof(p_postings) <> 'array'
     OR jsonb_array_length(p_postings) = 0 THEN
    RAISE EXCEPTION 'A transaction needs at least one posting';
  END IF;
  IF jsonb_array_length(p_postings) > 50 THEN
    RAISE EXCEPTION 'At most 50 postings in one transaction';
  END IF;

  FOR v_posting IN SELECT value FROM jsonb_array_elements(p_postings) LOOP
    INSERT INTO money_posting (
      user_id, transaction_id, account_id, category_id, amount_minor,
      currency, memo, fx_rate, base_amount_minor
    ) VALUES (
      p_uid,
      p_transaction,
      NULLIF(v_posting->>'account_id', '')::uuid,
      NULLIF(v_posting->>'category_id', '')::uuid,
      (v_posting->>'amount_minor')::bigint,
      NULL, -- taken from the account
      left(NULLIF(v_posting->>'memo', ''), 200),
      NULLIF(v_posting->>'fx_rate', '')::numeric,
      NULLIF(v_posting->>'base_amount_minor', '')::bigint
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.money_write_postings(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- Run the ledger's deferred checks now, then defer them again.
--
-- Now: so a bad transaction fails inside the call that wrote it, and the
-- whole call rolls back, instead of at COMMIT after the caller was told it
-- worked. Then deferred again: `SET CONSTRAINTS … IMMEDIATE` lasts for the
-- rest of the database transaction, and a second write in the same one would
-- otherwise be checked the moment its header is inserted — before it has any
-- postings — and always fail.
CREATE OR REPLACE FUNCTION public.money_flush_checks()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  SET CONSTRAINTS money_posting_balanced, money_transaction_consistent IMMEDIATE;
  SET CONSTRAINTS money_posting_balanced, money_transaction_consistent DEFERRED;
END;
$$;
REVOKE ALL ON FUNCTION public.money_flush_checks() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.money_record_transaction(
  p_transaction JSONB,
  p_postings JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL OR NOT public.is_aal2() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  -- Definer rights bypass the lockdown policies, so check here.
  IF public.writes_locked() THEN
    RAISE EXCEPTION 'Writes are locked: lower the lockdown level first'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  INSERT INTO money_transaction (
    user_id, date, kind, status, description, payee, notes, raw_description,
    schedule_id, occurrence_date, import_hash, import_batch_id, provider, market_rate
  ) VALUES (
    v_uid,
    (p_transaction->>'date')::date,
    (p_transaction->>'kind')::money_transaction_kind,
    coalesce(NULLIF(p_transaction->>'status', ''), 'cleared')::money_transaction_status,
    p_transaction->>'description',
    NULLIF(p_transaction->>'payee', ''),
    NULLIF(p_transaction->>'notes', ''),
    NULLIF(p_transaction->>'raw_description', ''),
    -- Only a schedule of the caller's own.
    (SELECT sc.id FROM money_schedule sc
      WHERE sc.id = NULLIF(p_transaction->>'schedule_id', '')::uuid
        AND sc.user_id = v_uid),
    CASE WHEN EXISTS (SELECT 1 FROM money_schedule sc
                       WHERE sc.id = NULLIF(p_transaction->>'schedule_id', '')::uuid
                         AND sc.user_id = v_uid)
         THEN NULLIF(p_transaction->>'occurrence_date', '')::date END,
    NULLIF(p_transaction->>'import_hash', ''),
    (SELECT b.id FROM money_import_batch b
      WHERE b.id = NULLIF(p_transaction->>'import_batch_id', '')::uuid
        AND b.user_id = v_uid),
    NULLIF(p_transaction->>'provider', ''),
    NULLIF(p_transaction->>'market_rate', '')::numeric
  )
  RETURNING id INTO v_id;

  PERFORM public.money_write_postings(v_uid, v_id, p_postings);

  PERFORM public.money_flush_checks();
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.money_record_transaction(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_record_transaction(JSONB, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.money_update_transaction(
  p_id UUID,
  p_transaction JSONB,
  p_postings JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.is_aal2() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  -- Definer rights bypass the lockdown policies, so check here.
  IF public.writes_locked() THEN
    RAISE EXCEPTION 'Writes are locked: lower the lockdown level first'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE money_transaction SET
    date            = (p_transaction->>'date')::date,
    kind            = (p_transaction->>'kind')::money_transaction_kind,
    status          = coalesce(NULLIF(p_transaction->>'status', ''), 'cleared')::money_transaction_status,
    description     = p_transaction->>'description',
    payee           = NULLIF(p_transaction->>'payee', ''),
    notes           = NULLIF(p_transaction->>'notes', ''),
    provider        = NULLIF(p_transaction->>'provider', ''),
    market_rate     = NULLIF(p_transaction->>'market_rate', '')::numeric
  WHERE id = p_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  DELETE FROM money_posting WHERE transaction_id = p_id;
  PERFORM public.money_write_postings(v_uid, p_id, p_postings);

  PERFORM public.money_flush_checks();
  RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.money_update_transaction(UUID, JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_update_transaction(UUID, JSONB, JSONB) TO authenticated;

-- A bank export, all or nothing. Rows whose `import_hash` is already in the
-- ledger are counted as duplicates and skipped rather than failing the batch.
--
-- p_batch: { account_id, file_name?, preset?, row_count }
-- p_rows:  [{ transaction: {...}, postings: [...] }, …]   (≤ 2000)
CREATE OR REPLACE FUNCTION public.money_import(p_batch JSONB, p_rows JSONB)
RETURNS TABLE (batch_id UUID, imported INT, duplicates INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_batch     UUID;
  v_row       JSONB;
  v_txn       JSONB;
  v_id        UUID;
  v_imported  INT := 0;
  v_duplicate INT := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.is_aal2() THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  -- Definer rights bypass the lockdown policies, so check here.
  IF public.writes_locked() THEN
    RAISE EXCEPTION 'Writes are locked: lower the lockdown level first'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'Nothing to import';
  END IF;
  IF jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'At most 2000 rows in one import';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM money_account
     WHERE id = NULLIF(p_batch->>'account_id', '')::uuid AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  INSERT INTO money_import_batch (user_id, account_id, file_name, preset, row_count)
  VALUES (
    v_uid,
    (p_batch->>'account_id')::uuid,
    left(NULLIF(p_batch->>'file_name', ''), 200),
    left(NULLIF(p_batch->>'preset', ''), 40),
    coalesce((p_batch->>'row_count')::int, jsonb_array_length(p_rows))
  )
  RETURNING id INTO v_batch;

  FOR v_row IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    v_txn := v_row->'transaction';
    IF NULLIF(v_txn->>'import_hash', '') IS NOT NULL AND EXISTS (
      SELECT 1 FROM money_transaction
       WHERE user_id = v_uid AND import_hash = v_txn->>'import_hash'
    ) THEN
      v_duplicate := v_duplicate + 1;
      CONTINUE;
    END IF;

    INSERT INTO money_transaction (
      user_id, date, kind, status, description, payee, raw_description,
      import_hash, import_batch_id
    ) VALUES (
      v_uid,
      (v_txn->>'date')::date,
      (v_txn->>'kind')::money_transaction_kind,
      coalesce(NULLIF(v_txn->>'status', ''), 'cleared')::money_transaction_status,
      v_txn->>'description',
      NULLIF(v_txn->>'payee', ''),
      NULLIF(v_txn->>'raw_description', ''),
      NULLIF(v_txn->>'import_hash', ''),
      v_batch
    )
    RETURNING id INTO v_id;
    PERFORM public.money_write_postings(v_uid, v_id, v_row->'postings');
    v_imported := v_imported + 1;
  END LOOP;

  UPDATE money_import_batch
     SET imported_count = v_imported, duplicate_count = v_duplicate
   WHERE id = v_batch;

  PERFORM public.money_flush_checks();
  RETURN QUERY SELECT v_batch, v_imported, v_duplicate;
END;
$$;
REVOKE ALL ON FUNCTION public.money_import(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_import(JSONB, JSONB) TO authenticated;


-- ── Recurring schedules ─────────────────────────────────────────────────────
--
-- Everything that repeats: the paycheque every other Friday, rent on the
-- 1st, the phone bill, a monthly transfer home. A schedule does not write
-- transactions by itself — this is a static site with no server to run a
-- job — it says what is due, and the owner records it (one click, or all at
-- once). A recorded occurrence carries `schedule_id` + `occurrence_date`,
-- the *due* date, so a paycheque due Friday and entered Monday is still
-- Friday's, and it can never be recorded twice.

DO $$ BEGIN
  CREATE TYPE money_frequency AS ENUM
    ('once','weekly','biweekly','semimonthly','monthly','quarterly','yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_schedule (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  kind          money_transaction_kind NOT NULL,
  account_id    UUID NOT NULL REFERENCES money_account(id) ON DELETE CASCADE,
  to_account_id UUID REFERENCES money_account(id) ON DELETE CASCADE,
  category_id   UUID REFERENCES money_category(id) ON DELETE SET NULL,
  -- In `account_id`'s currency, always positive; the kind gives direction.
  amount_minor  BIGINT NOT NULL CHECK (amount_minor > 0),
  -- A transfer into another currency: roughly what arrives.
  to_amount_minor BIGINT CHECK (to_amount_minor IS NULL OR to_amount_minor > 0),
  -- Hydro, a phone bill with usage: the amount is a guess until it lands.
  is_estimate   BOOLEAN NOT NULL DEFAULT false,
  frequency     money_frequency NOT NULL DEFAULT 'monthly',
  start_date    DATE NOT NULL,
  end_date      DATE,
  -- Semi-monthly pay: the two days of the month (e.g. 15 and 31 = last).
  day_one       SMALLINT CHECK (day_one IS NULL OR day_one BETWEEN 1 AND 31),
  day_two       SMALLINT CHECK (day_two IS NULL OR day_two BETWEEN 1 AND 31),
  payee         TEXT CHECK (payee IS NULL OR char_length(payee) <= 200),
  notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_schedule_kind CHECK (kind IN ('expense','income','transfer')),
  CONSTRAINT money_schedule_transfer_target CHECK (
    (kind = 'transfer') = (to_account_id IS NOT NULL)
  ),
  CONSTRAINT money_schedule_distinct_accounts CHECK (to_account_id IS DISTINCT FROM account_id),
  CONSTRAINT money_schedule_ends_after_start CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT money_schedule_semimonthly_days CHECK (
    (frequency = 'semimonthly') = (day_one IS NOT NULL AND day_two IS NOT NULL)
  ),
  CONSTRAINT money_schedule_days_differ CHECK (day_one IS NULL OR day_one <> day_two)
);
CREATE INDEX IF NOT EXISTS money_schedule_user_idx ON money_schedule (user_id) WHERE archived_at IS NULL;
ALTER TABLE money_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages schedules" ON money_schedule;
CREATE POLICY "Owner manages schedules" ON money_schedule FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_schedule_updated_at ON money_schedule;
CREATE TRIGGER update_money_schedule_updated_at BEFORE UPDATE ON money_schedule
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS money_schedule_skip (
  schedule_id UUID NOT NULL REFERENCES money_schedule(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  due_date    DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (schedule_id, due_date)
);
ALTER TABLE money_schedule_skip ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages schedule skips" ON money_schedule_skip;
CREATE POLICY "Owner manages schedule skips" ON money_schedule_skip FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

DO $$ BEGIN
  ALTER TABLE money_transaction
    ADD CONSTRAINT money_transaction_schedule_fkey
    FOREIGN KEY (schedule_id) REFERENCES money_schedule(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Deleting a schedule keeps the transactions it produced, unlinked. Both
-- link columns are cleared together — the pair CHECK allows neither alone.
CREATE OR REPLACE FUNCTION public.money_unlink_schedule()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE money_transaction SET schedule_id = NULL, occurrence_date = NULL
   WHERE schedule_id = OLD.id;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS money_schedule_unlink ON money_schedule;
CREATE TRIGGER money_schedule_unlink BEFORE DELETE ON money_schedule
  FOR EACH ROW EXECUTE FUNCTION public.money_unlink_schedule();


-- ── Budgets ─────────────────────────────────────────────────────────────────
--
-- "From March, $450 a month on groceries." A budget row applies from its
-- month until the next row for the same category, so changing a budget
-- never rewrites last month's. Amounts are in the base currency, like the
-- spending they are compared with. `rollover` carries an unspent (or
-- overspent) remainder into the next month.

CREATE TABLE IF NOT EXISTS money_budget (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  category_id  UUID NOT NULL REFERENCES money_category(id) ON DELETE CASCADE,
  -- The first day of the month it starts in.
  from_month   DATE NOT NULL CHECK (extract(day FROM from_month) = 1),
  -- Zero means "stop budgeting this from here".
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  rollover     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, from_month)
);
ALTER TABLE money_budget ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages budgets" ON money_budget;
CREATE POLICY "Owner manages budgets" ON money_budget FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());


-- ── Goals ───────────────────────────────────────────────────────────────────
--
-- What the owner is saving towards — an emergency fund, a down payment, a
-- trip home — measured by the balances of the accounts set aside for it.
-- Progress is derived, never typed: the goal is exactly as far along as
-- those accounts say.

CREATE TABLE IF NOT EXISTS money_goal (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  target_minor BIGINT NOT NULL CHECK (target_minor > 0),
  currency     CHAR(3) NOT NULL REFERENCES money_currency(code),
  target_date  DATE,
  notes        TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  sort_order   INT NOT NULL DEFAULT 0,
  achieved_at  TIMESTAMPTZ,
  archived_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE money_goal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages goals" ON money_goal;
CREATE POLICY "Owner manages goals" ON money_goal FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_goal_updated_at ON money_goal;
CREATE TRIGGER update_money_goal_updated_at BEFORE UPDATE ON money_goal
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS money_goal_account (
  goal_id    UUID NOT NULL REFERENCES money_goal(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES money_account(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  PRIMARY KEY (goal_id, account_id)
);
ALTER TABLE money_goal_account ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages goal accounts" ON money_goal_account;
CREATE POLICY "Owner manages goal accounts" ON money_goal_account FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

-- An account counts towards one goal only: two goals claiming the same
-- savings would both look funded by the same dollars.
CREATE UNIQUE INDEX IF NOT EXISTS money_goal_account_once ON money_goal_account (account_id);

-- A goal and its accounts saved together. Invoker rights: row-level security
-- applies as for any write, and one call is one transaction, so the goal is
-- never saved with half its accounts.
CREATE OR REPLACE FUNCTION public.money_save_goal(p_goal JSONB, p_accounts UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID := NULLIF(p_goal->>'id', '')::uuid;
BEGIN
  IF v_id IS NULL THEN
    INSERT INTO money_goal (name, target_minor, currency, target_date, notes, sort_order)
    VALUES (
      p_goal->>'name',
      (p_goal->>'target_minor')::bigint,
      p_goal->>'currency',
      NULLIF(p_goal->>'target_date', '')::date,
      NULLIF(p_goal->>'notes', ''),
      coalesce((p_goal->>'sort_order')::int, 0)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE money_goal SET
      name         = p_goal->>'name',
      target_minor = (p_goal->>'target_minor')::bigint,
      currency     = p_goal->>'currency',
      target_date  = NULLIF(p_goal->>'target_date', '')::date,
      notes        = NULLIF(p_goal->>'notes', '')
    WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Goal not found';
    END IF;
  END IF;

  DELETE FROM money_goal_account WHERE goal_id = v_id;
  INSERT INTO money_goal_account (goal_id, account_id)
  SELECT v_id, account FROM unnest(coalesce(p_accounts, '{}')) AS account;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.money_save_goal(JSONB, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_save_goal(JSONB, UUID[]) TO authenticated;


-- ── Loans ───────────────────────────────────────────────────────────────────
--
-- The terms of a debt, attached to the ledger account that holds it. The
-- account's balance is what is owed — it moves with the payments the owner
-- records — and these terms turn it into a schedule: what each payment is,
-- how much of it is interest, when it ends, what a lump sum would save.
--
-- Canadian fixed-rate mortgages compound semi-annually by law (the Interest
-- Act), most other loans monthly; lines of credit accrue daily. Accelerated
-- bi-weekly pays half the monthly payment every two weeks — 26 halves, one
-- extra monthly payment a year.

DO $$ BEGIN
  CREATE TYPE money_compounding AS ENUM ('monthly','semiannual','daily');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE money_payment_frequency AS ENUM
    ('monthly','semimonthly','biweekly','accelerated_biweekly','weekly','accelerated_weekly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_loan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  account_id          UUID NOT NULL UNIQUE REFERENCES money_account(id) ON DELETE CASCADE,
  lender              TEXT CHECK (lender IS NULL OR char_length(lender) <= 120),
  -- What was borrowed, in the account's currency.
  principal_minor     BIGINT NOT NULL CHECK (principal_minor > 0),
  annual_rate         NUMERIC(6,3) NOT NULL CHECK (annual_rate BETWEEN 0 AND 100),
  rate_type           TEXT NOT NULL DEFAULT 'fixed' CHECK (rate_type IN ('fixed','variable')),
  compounding         money_compounding NOT NULL DEFAULT 'monthly',
  payment_frequency   money_payment_frequency NOT NULL DEFAULT 'monthly',
  -- The payment the lender set; null means "whatever amortises the loan".
  payment_minor       BIGINT CHECK (payment_minor IS NULL OR payment_minor > 0),
  amortization_months INT NOT NULL CHECK (amortization_months BETWEEN 1 AND 600),
  -- A mortgage's term (e.g. 60 months), after which it renews.
  term_months         INT CHECK (term_months IS NULL OR term_months BETWEEN 1 AND 600),
  first_payment_date  DATE NOT NULL,
  -- Lump sums the lender allows each year without penalty, as a share of
  -- the original principal (often 10–20% on a Canadian mortgage).
  prepayment_allowance_pct NUMERIC(5,2) CHECK (prepayment_allowance_pct IS NULL OR prepayment_allowance_pct BETWEEN 0 AND 100),
  notes               TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_loan_term_within_amortization CHECK (term_months IS NULL OR term_months <= amortization_months)
);
ALTER TABLE money_loan ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages loans" ON money_loan;
CREATE POLICY "Owner manages loans" ON money_loan FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_loan_updated_at ON money_loan;
CREATE TRIGGER update_money_loan_updated_at BEFORE UPDATE ON money_loan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Terms only make sense on a debt.
CREATE OR REPLACE FUNCTION public.money_check_loan_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM money_account
     WHERE id = NEW.account_id AND user_id = NEW.user_id
       AND kind IN ('loan','mortgage','line_of_credit')
  ) THEN
    RAISE EXCEPTION 'Loan terms belong on a loan, mortgage or line-of-credit account';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_loan_account_kind ON money_loan;
CREATE TRIGGER money_loan_account_kind BEFORE INSERT OR UPDATE ON money_loan
  FOR EACH ROW EXECUTE FUNCTION public.money_check_loan_account();

-- …and an account with loan terms stays a debt.
CREATE OR REPLACE FUNCTION public.money_keep_loan_account_kind()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.kind NOT IN ('loan','mortgage','line_of_credit')
     AND EXISTS (SELECT 1 FROM money_loan WHERE account_id = NEW.id) THEN
    RAISE EXCEPTION 'This account has loan terms; remove them before changing its type';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_account_keeps_loan_kind ON money_account;
CREATE TRIGGER money_account_keeps_loan_kind BEFORE UPDATE OF kind ON money_account
  FOR EACH ROW EXECUTE FUNCTION public.money_keep_loan_account_kind();


-- ── Income sources ──────────────────────────────────────────────────────────
--
-- What a lender asks first: who pays you, since when, and how much before
-- deductions. Deposits show take-home pay; this is the gross figure, the
-- employment type and the start date (probation and tenure matter).

DO $$ BEGIN
  CREATE TYPE money_employment AS ENUM
    ('full_time','part_time','contract','self_employed','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_income_source (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  employment    money_employment NOT NULL DEFAULT 'full_time',
  role          TEXT CHECK (role IS NULL OR char_length(role) <= 120),
  gross_annual_minor BIGINT NOT NULL CHECK (gross_annual_minor > 0),
  currency      CHAR(3) NOT NULL REFERENCES money_currency(code),
  start_date    DATE NOT NULL,
  end_date      DATE,
  country       CHAR(2) NOT NULL DEFAULT 'CA' CHECK (country ~ '^[A-Z]{2}$'),
  notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_income_source_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
ALTER TABLE money_income_source ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages income sources" ON money_income_source;
CREATE POLICY "Owner manages income sources" ON money_income_source FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_income_source_updated_at ON money_income_source;
CREATE TRIGGER update_money_income_source_updated_at BEFORE UPDATE ON money_income_source
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── Credit scores ───────────────────────────────────────────────────────────
-- Canadian bureau scores run 300–900. Logged by hand from a free service
-- (Borrowell, Credit Karma, a bank app), so the trend is visible.

DO $$ BEGIN
  CREATE TYPE money_bureau AS ENUM ('equifax','transunion','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_credit_score (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  bureau     money_bureau NOT NULL,
  score      SMALLINT NOT NULL CHECK (score BETWEEN 300 AND 900),
  as_of      DATE NOT NULL,
  source     TEXT CHECK (source IS NULL OR char_length(source) <= 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, bureau, as_of)
);
ALTER TABLE money_credit_score ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages credit scores" ON money_credit_score;
CREATE POLICY "Owner manages credit scores" ON money_credit_score FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());


-- ── Loan applications ───────────────────────────────────────────────────────
--
-- Each time the owner applies for credit: with whom, for what, where it
-- stands, what the lender still needs — and the hard inquiry it put on the
-- credit file, because several in a short time cost points.

DO $$ BEGIN
  CREATE TYPE money_credit_product AS ENUM
    ('mortgage','auto_loan','personal_loan','line_of_credit','credit_card','student_loan','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE money_application_status AS ENUM
    ('planning','submitted','conditional','approved','declined','withdrawn','funded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_application (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  lender              TEXT NOT NULL CHECK (char_length(lender) BETWEEN 1 AND 120),
  product             money_credit_product NOT NULL,
  status              money_application_status NOT NULL DEFAULT 'planning',
  amount_minor        BIGINT CHECK (amount_minor IS NULL OR amount_minor > 0),
  currency            CHAR(3) NOT NULL REFERENCES money_currency(code),
  -- Offered or expected, annual %.
  rate                NUMERIC(6,3) CHECK (rate IS NULL OR rate BETWEEN 0 AND 100),
  term_months         INT CHECK (term_months IS NULL OR term_months BETWEEN 1 AND 600),
  amortization_months INT CHECK (amortization_months IS NULL OR amortization_months BETWEEN 1 AND 600),
  -- Mortgage: the home, and the costs lenders count against income.
  purchase_price_minor   BIGINT CHECK (purchase_price_minor IS NULL OR purchase_price_minor > 0),
  down_payment_minor     BIGINT CHECK (down_payment_minor IS NULL OR down_payment_minor >= 0),
  property_tax_monthly_minor BIGINT CHECK (property_tax_monthly_minor IS NULL OR property_tax_monthly_minor >= 0),
  heating_monthly_minor  BIGINT CHECK (heating_monthly_minor IS NULL OR heating_monthly_minor >= 0),
  condo_fees_monthly_minor BIGINT CHECK (condo_fees_monthly_minor IS NULL OR condo_fees_monthly_minor >= 0),
  submitted_on        DATE,
  decided_on          DATE,
  hard_inquiry_on     DATE,
  notes               TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_application_decided_after_submitted
    CHECK (decided_on IS NULL OR submitted_on IS NULL OR decided_on >= submitted_on),
  CONSTRAINT money_application_down_payment_fits
    CHECK (down_payment_minor IS NULL OR purchase_price_minor IS NULL OR down_payment_minor <= purchase_price_minor)
);
ALTER TABLE money_application ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages applications" ON money_application;
CREATE POLICY "Owner manages applications" ON money_application FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_application_updated_at ON money_application;
CREATE TRIGGER update_money_application_updated_at BEFORE UPDATE ON money_application
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$ BEGIN
  CREATE TYPE money_document_status AS ENUM ('needed','ready','sent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_application_doc (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  application_id UUID NOT NULL REFERENCES money_application(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  status         money_document_status NOT NULL DEFAULT 'needed',
  note           TEXT CHECK (note IS NULL OR char_length(note) <= 300),
  sort_order     INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (application_id, name)
);
ALTER TABLE money_application_doc ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages application documents" ON money_application_doc;
CREATE POLICY "Owner manages application documents" ON money_application_doc FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

-- A new application and its starter checklist in one step (invoker rights,
-- so row-level security applies as for any write).
CREATE OR REPLACE FUNCTION public.money_create_application(p_application JSONB, p_documents TEXT[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO money_application (
    lender, product, status, amount_minor, currency, rate, term_months,
    amortization_months, purchase_price_minor, down_payment_minor,
    property_tax_monthly_minor, heating_monthly_minor, condo_fees_monthly_minor,
    submitted_on, decided_on, hard_inquiry_on, notes
  ) VALUES (
    p_application->>'lender',
    (p_application->>'product')::money_credit_product,
    coalesce(NULLIF(p_application->>'status', ''), 'planning')::money_application_status,
    NULLIF(p_application->>'amount_minor', '')::bigint,
    p_application->>'currency',
    NULLIF(p_application->>'rate', '')::numeric,
    NULLIF(p_application->>'term_months', '')::int,
    NULLIF(p_application->>'amortization_months', '')::int,
    NULLIF(p_application->>'purchase_price_minor', '')::bigint,
    NULLIF(p_application->>'down_payment_minor', '')::bigint,
    NULLIF(p_application->>'property_tax_monthly_minor', '')::bigint,
    NULLIF(p_application->>'heating_monthly_minor', '')::bigint,
    NULLIF(p_application->>'condo_fees_monthly_minor', '')::bigint,
    NULLIF(p_application->>'submitted_on', '')::date,
    NULLIF(p_application->>'decided_on', '')::date,
    NULLIF(p_application->>'hard_inquiry_on', '')::date,
    NULLIF(p_application->>'notes', '')
  )
  RETURNING id INTO v_id;
  INSERT INTO money_application_doc (application_id, name, sort_order)
  SELECT v_id, name, ordinality - 1
    FROM unnest(coalesce(p_documents, '{}')) WITH ORDINALITY AS d(name, ordinality);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.money_create_application(JSONB, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_create_application(JSONB, TEXT[]) TO authenticated;


-- ── Investing ───────────────────────────────────────────────────────────────
--
-- Securities, their prices (entered by hand or pasted from a CSV) and the
-- trades in each investment account.
--
-- The ledger keeps only what is income or expense: a dividend, interest, a
-- fee — each trade of that kind owns one ledger transaction, written by
-- money_save_trade from the trade itself so the two cannot disagree. Buys,
-- sells, returns of capital and splits never touch the ledger: the account's
-- cash, each holding's quantity and adjusted cost base (ACB), and realised
-- gains are worked out from the trades (domain/invest.ts). Editing an old
-- buy therefore changes every later gain without any posted figure going
-- stale.

DO $$ BEGIN
  CREATE TYPE money_asset_class AS ENUM
    ('equity','fixed_income','cash','real_estate','commodity','crypto','balanced','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE money_region AS ENUM
    ('canada','us','india','international','emerging','global','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE money_trade_kind AS ENUM
    ('buy','sell','reinvest','dividend','interest','fee','return_of_capital','split');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS money_security (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  symbol       TEXT NOT NULL CHECK (symbol ~ '^[A-Z0-9][A-Z0-9.:^-]{0,19}$'),
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  currency     CHAR(3) NOT NULL REFERENCES money_currency(code),
  asset_class  money_asset_class NOT NULL DEFAULT 'equity',
  region       money_region NOT NULL DEFAULT 'global',
  notes        TEXT CHECK (notes IS NULL OR char_length(notes) <= 1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, symbol)
);
ALTER TABLE money_security ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages securities" ON money_security;
CREATE POLICY "Owner manages securities" ON money_security FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_security_updated_at ON money_security;
CREATE TRIGGER update_money_security_updated_at BEFORE UPDATE ON money_security
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A price per unit, in the security's currency, at the close of a day.
CREATE TABLE IF NOT EXISTS money_price (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  security_id  UUID NOT NULL REFERENCES money_security(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  price        NUMERIC(20,6) NOT NULL CHECK (price > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (security_id, date)
);
ALTER TABLE money_price ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages prices" ON money_price;
CREATE POLICY "Owner manages prices" ON money_price FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

CREATE TABLE IF NOT EXISTS money_trade (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  account_id     UUID NOT NULL REFERENCES money_account(id) ON DELETE CASCADE,
  security_id    UUID REFERENCES money_security(id) ON DELETE RESTRICT,
  date           DATE NOT NULL,
  kind           money_trade_kind NOT NULL,
  -- Units bought, sold or reinvested; for a split, new units per old unit.
  quantity       NUMERIC(24,8) CHECK (quantity IS NULL OR quantity > 0),
  -- Cash, in the account's currency: the gross value of a buy or sell, or
  -- the dividend, interest, fee or return of capital.
  amount_minor   BIGINT NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  -- Commission on a buy or sell. Added to the cost of a buy and taken off
  -- the proceeds of a sell, as the CRA counts it.
  fee_minor      BIGINT NOT NULL DEFAULT 0 CHECK (fee_minor >= 0),
  -- The ledger's record of a dividend, interest, fee or reinvested
  -- distribution. Deleting that transaction deletes the trade with it.
  transaction_id UUID UNIQUE REFERENCES money_transaction(id) ON DELETE CASCADE,
  notes          TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT money_trade_shape CHECK (
    CASE kind
      WHEN 'buy'      THEN security_id IS NOT NULL AND quantity IS NOT NULL
      WHEN 'sell'     THEN security_id IS NOT NULL AND quantity IS NOT NULL
      WHEN 'reinvest' THEN security_id IS NOT NULL AND quantity IS NOT NULL AND amount_minor > 0 AND fee_minor = 0
      WHEN 'split'    THEN security_id IS NOT NULL AND quantity IS NOT NULL AND amount_minor = 0 AND fee_minor = 0
      WHEN 'dividend' THEN security_id IS NOT NULL AND quantity IS NULL AND amount_minor > 0 AND fee_minor = 0
      WHEN 'return_of_capital' THEN security_id IS NOT NULL AND quantity IS NULL AND amount_minor > 0 AND fee_minor = 0
      ELSE quantity IS NULL AND amount_minor > 0 AND fee_minor = 0   -- interest, fee
    END),
  CONSTRAINT money_trade_in_ledger CHECK (
    (kind IN ('dividend','interest','fee','reinvest')) = (transaction_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS money_trade_account_date ON money_trade (account_id, date);
CREATE INDEX IF NOT EXISTS money_trade_security ON money_trade (security_id);
ALTER TABLE money_trade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages trades" ON money_trade;
CREATE POLICY "Owner manages trades" ON money_trade FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_trade_updated_at ON money_trade;
CREATE TRIGGER update_money_trade_updated_at BEFORE UPDATE ON money_trade
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A price or trade may only point at the owner's own rows (foreign keys
-- ignore row-level security), a trade only into an investment account, and
-- only in a security priced in the account's currency.
CREATE OR REPLACE FUNCTION public.money_check_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM money_security WHERE id = NEW.security_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Security not found';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_price_owner ON money_price;
CREATE TRIGGER money_price_owner BEFORE INSERT OR UPDATE ON money_price
  FOR EACH ROW EXECUTE FUNCTION public.money_check_price();

CREATE OR REPLACE FUNCTION public.money_check_trade()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_account money_account%ROWTYPE;
  v_currency CHAR(3);
BEGIN
  SELECT * INTO v_account FROM money_account WHERE id = NEW.account_id AND user_id = NEW.user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  IF v_account.kind <> 'investment' THEN
    RAISE EXCEPTION 'Trades belong in an investment account';
  END IF;
  IF NEW.date < v_account.opening_date THEN
    RAISE EXCEPTION 'A trade cannot come before the account''s opening date';
  END IF;
  IF NEW.security_id IS NOT NULL THEN
    SELECT currency INTO v_currency FROM money_security WHERE id = NEW.security_id AND user_id = NEW.user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Security not found';
    END IF;
    IF v_currency <> v_account.currency THEN
      RAISE EXCEPTION 'This security trades in %, the account holds %: keep a separate account for each currency', v_currency, v_account.currency;
    END IF;
  END IF;
  IF NEW.transaction_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM money_transaction WHERE id = NEW.transaction_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_trade_check ON money_trade;
CREATE TRIGGER money_trade_check BEFORE INSERT OR UPDATE ON money_trade
  FOR EACH ROW EXECUTE FUNCTION public.money_check_trade();

-- …and neither side can later change under the trades.
CREATE OR REPLACE FUNCTION public.money_keep_security_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.currency <> OLD.currency AND EXISTS (SELECT 1 FROM money_trade WHERE security_id = NEW.id) THEN
    RAISE EXCEPTION 'This security has trades; its currency cannot change';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_security_keeps_currency ON money_security;
CREATE TRIGGER money_security_keeps_currency BEFORE UPDATE OF currency ON money_security
  FOR EACH ROW EXECUTE FUNCTION public.money_keep_security_currency();

CREATE OR REPLACE FUNCTION public.money_keep_trade_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.kind <> 'investment' OR NEW.currency <> OLD.currency)
     AND EXISTS (SELECT 1 FROM money_trade WHERE account_id = NEW.id) THEN
    RAISE EXCEPTION 'This account has trades; it stays an investment account in %', OLD.currency;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS money_account_keeps_trades ON money_account;
CREATE TRIGGER money_account_keeps_trades BEFORE UPDATE OF kind, currency ON money_account
  FOR EACH ROW EXECUTE FUNCTION public.money_keep_trade_account();

-- One trade and, for the kinds that are income or expense, its ledger
-- transaction — written together from the trade, all or nothing. Invoker
-- rights: row-level security applies, and money_record_transaction /
-- money_update_transaction make their own checks.
--
-- p_trade: { id?, account_id, security_id?, date, kind, quantity?, amount_minor,
--            fee_minor?, notes?, category_id?, description?, fx_rate?,
--            base_amount_minor? (unsigned, when the account is not in the base currency) }
CREATE OR REPLACE FUNCTION public.money_save_trade(p_trade JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id       UUID := NULLIF(p_trade->>'id', '')::uuid;
  v_kind     money_trade_kind := (p_trade->>'kind')::money_trade_kind;
  v_amount   BIGINT := coalesce(NULLIF(p_trade->>'amount_minor', '')::bigint, 0);
  v_old_txn  UUID;
  v_txn      UUID;
  v_header   JSONB;
  v_postings JSONB;
BEGIN
  IF v_id IS NOT NULL THEN
    SELECT transaction_id INTO v_old_txn FROM money_trade WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Trade not found';
    END IF;
  END IF;

  IF v_kind IN ('dividend','interest','fee','reinvest') THEN
    IF v_amount <= 0 THEN
      RAISE EXCEPTION 'The amount has to be more than zero';
    END IF;
    v_header := jsonb_build_object(
      'date', p_trade->>'date',
      'kind', CASE WHEN v_kind = 'fee' THEN 'expense' ELSE 'income' END,
      'status', 'cleared',
      'description', coalesce(NULLIF(p_trade->>'description', ''), initcap(replace(v_kind::text, '_', ' '))));
    v_postings := jsonb_build_array(jsonb_build_object(
      'account_id', p_trade->>'account_id',
      'category_id', p_trade->>'category_id',
      'amount_minor', CASE WHEN v_kind = 'fee' THEN -v_amount ELSE v_amount END,
      'fx_rate', p_trade->>'fx_rate',
      'base_amount_minor', CASE WHEN v_kind = 'fee' THEN -(p_trade->>'base_amount_minor')::bigint
                                ELSE (p_trade->>'base_amount_minor')::bigint END));
    IF v_old_txn IS NOT NULL THEN
      v_txn := public.money_update_transaction(v_old_txn, v_header, v_postings);
    ELSE
      v_txn := public.money_record_transaction(v_header, v_postings);
    END IF;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO money_trade (account_id, security_id, date, kind, quantity, amount_minor, fee_minor, transaction_id, notes)
    VALUES (
      (p_trade->>'account_id')::uuid,
      NULLIF(p_trade->>'security_id', '')::uuid,
      (p_trade->>'date')::date,
      v_kind,
      NULLIF(p_trade->>'quantity', '')::numeric,
      v_amount,
      coalesce(NULLIF(p_trade->>'fee_minor', '')::bigint, 0),
      v_txn,
      NULLIF(p_trade->>'notes', ''))
    RETURNING id INTO v_id;
  ELSE
    UPDATE money_trade SET
      account_id     = (p_trade->>'account_id')::uuid,
      security_id    = NULLIF(p_trade->>'security_id', '')::uuid,
      date           = (p_trade->>'date')::date,
      kind           = v_kind,
      quantity       = NULLIF(p_trade->>'quantity', '')::numeric,
      amount_minor   = v_amount,
      fee_minor      = coalesce(NULLIF(p_trade->>'fee_minor', '')::bigint, 0),
      transaction_id = v_txn,
      notes          = NULLIF(p_trade->>'notes', '')
    WHERE id = v_id;
    -- A dividend edited into a buy no longer belongs in the ledger.
    IF v_old_txn IS NOT NULL AND v_txn IS NULL THEN
      DELETE FROM money_transaction WHERE id = v_old_txn;
    END IF;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.money_save_trade(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_save_trade(JSONB) TO authenticated;

-- A trade and its ledger transaction go together.
CREATE OR REPLACE FUNCTION public.money_delete_trade(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn UUID;
BEGIN
  DELETE FROM money_trade WHERE id = p_id RETURNING transaction_id INTO v_txn;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trade not found';
  END IF;
  IF v_txn IS NOT NULL THEN
    DELETE FROM money_transaction WHERE id = v_txn;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.money_delete_trade(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_delete_trade(UUID) TO authenticated;

-- ── Contribution room ───────────────────────────────────────────────────────
--
-- The room the CRA reports at the start of a year (My Account, or the
-- Notice of Assessment for RRSP). What was put in since is read from the
-- ledger: transfers into accounts with that registration.

CREATE TABLE IF NOT EXISTS money_room (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  registration  money_registration NOT NULL CHECK (registration IN ('tfsa','rrsp','fhsa')),
  year          INT NOT NULL CHECK (year BETWEEN 2009 AND 2100),
  -- Can be below zero after an over-contribution.
  room_minor    BIGINT NOT NULL CHECK (room_minor BETWEEN -100000000 AND 100000000),
  notes         TEXT CHECK (notes IS NULL OR char_length(notes) <= 500),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, registration, year)
);
ALTER TABLE money_room ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner manages contribution room" ON money_room;
CREATE POLICY "Owner manages contribution room" ON money_room FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());
DROP TRIGGER IF EXISTS update_money_room_updated_at ON money_room;
CREATE TRIGGER update_money_room_updated_at BEFORE UPDATE ON money_room
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ── Reading balances ────────────────────────────────────────────────────────
-- The app derives balances from postings itself (domain/ledger.ts); this is
-- the same arithmetic in SQL, for callers that should not load a ledger —
-- and for the database tests, which hold the two to the same answer.

CREATE OR REPLACE FUNCTION public.money_balances(p_as_of DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (account_id UUID, currency CHAR(3), balance_minor BIGINT, cleared_minor BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT a.id,
         a.currency,
         a.opening_balance_minor + coalesce(s.total, 0),
         a.opening_balance_minor + coalesce(s.cleared, 0)
    FROM money_account a
    LEFT JOIN LATERAL (
      SELECT sum(p.amount_minor)::bigint AS total,
             (sum(p.amount_minor) FILTER (WHERE t.status <> 'pending'))::bigint AS cleared
        FROM money_posting p
        JOIN money_transaction t ON t.id = p.transaction_id
       WHERE p.account_id = a.id AND t.date <= p_as_of
    ) s ON true
   WHERE a.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.money_balances(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_balances(DATE) TO authenticated;

-- Per day, what came in and went out, in the base currency's MAJOR units —
-- for the calendar and the dashboard, which format but never do money
-- arithmetic. `earned` is income; `spent` is expenses less refunds, plus
-- transfer fees. Transfers between the owner's own accounts are neither.
-- Pending and unpriced postings are left out rather than guessed.
CREATE OR REPLACE FUNCTION public.money_day_flows(p_from DATE, p_to DATE)
RETURNS TABLE (day DATE, earned NUMERIC, spent NUMERIC, entries BIGINT)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH unit AS (
    SELECT power(10, coalesce(
      (SELECT c.exponent FROM money_settings s
         JOIN money_currency c ON c.code = s.base_currency
        WHERE s.user_id = auth.uid()),
      2))::numeric AS scale
  ),
  counted AS (
    SELECT t.id, t.date, t.kind, p.base_amount_minor AS amount
      FROM money_transaction t
      JOIN money_posting p ON p.transaction_id = t.id
     WHERE t.user_id = auth.uid()
       AND t.date BETWEEN p_from AND p_to
       AND t.status <> 'pending'
       AND p.base_amount_minor IS NOT NULL
       AND (t.kind IN ('expense','income','refund')
            OR (t.kind = 'transfer' AND p.category_id IS NOT NULL))
  )
  SELECT counted.date,
         coalesce(sum(amount) FILTER (WHERE kind = 'income'), 0) / (SELECT scale FROM unit),
         coalesce(-sum(amount) FILTER (WHERE kind <> 'income'), 0) / (SELECT scale FROM unit),
         count(DISTINCT counted.id)
    FROM counted
   GROUP BY counted.date;
$$;
REVOKE ALL ON FUNCTION public.money_day_flows(DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.money_day_flows(DATE, DATE) TO authenticated;


-- =========================================================
-- 20. MAPS — visual concept & problem-solving maps
-- =========================================================
--
-- One row per map; the whole graph lives in `doc`, the same
-- document the app exports as JSON. Saves are whole-document and debounced.
--
-- `revision` is optimistic concurrency: the app saves with
--   UPDATE … SET revision = revision + 1 … WHERE id = $1 AND revision = $2
-- and treats "no row updated" as "changed in another tab" instead of
-- overwriting it. `node_count` / `edge_count` are for the list view, which
-- never loads `doc`.

CREATE TABLE IF NOT EXISTS thinking_maps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name           TEXT NOT NULL DEFAULT 'Untitled map'
                   CHECK (char_length(name) BETWEEN 1 AND 200),
  doc            JSONB NOT NULL DEFAULT '{}'::jsonb,
  schema_version INT NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  revision       INT NOT NULL DEFAULT 0 CHECK (revision >= 0),
  node_count     INT NOT NULL DEFAULT 0 CHECK (node_count >= 0),
  edge_count     INT NOT NULL DEFAULT 0 CHECK (edge_count >= 0),
  is_pinned      BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- ~5 MB. A 1,000-node map is ~300 KB; this stops a runaway paste, not use.
  CONSTRAINT thinking_maps_doc_size CHECK (octet_length(doc::text) <= 5000000)
);

CREATE INDEX IF NOT EXISTS thinking_maps_list_idx
  ON thinking_maps (user_id, is_pinned DESC, updated_at DESC);

ALTER TABLE thinking_maps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin manage thinking maps" ON thinking_maps;
CREATE POLICY "Admin manage thinking maps" ON thinking_maps FOR ALL
  USING (auth.uid() = user_id AND public.is_aal2())
  WITH CHECK (auth.uid() = user_id AND public.is_aal2());

DROP TRIGGER IF EXISTS update_thinking_maps_updated_at ON thinking_maps;
CREATE TRIGGER update_thinking_maps_updated_at BEFORE UPDATE ON thinking_maps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =========================================================
-- 99. LOCKDOWN ENFORCEMENT
-- =========================================================
--
-- The Security page promised that level 2 makes the database refuse every
-- admin write, and nothing enforced it: the rule lived in a migration that was
-- never folded into this file. A security switch that only changes a message
-- is worse than no switch, because the owner stops looking.
--
-- RESTRICTIVE policies are ANDed with the permissive ones, so they can only
-- take access away. Reads are untouched — during an incident the owner still
-- needs to see what happened. Two deliberate exemptions:
--   * security_settings, so the level can always be lowered again;
--   * anonymous INSERTs into contact_submissions and site_visits, which are
--     visitor actions, not admin writes, and the analytics beacon must never
--     turn a page view into an error.
--
-- This block is last on purpose: it covers every public table that exists
-- when it runs, including ones added above it later.

CREATE OR REPLACE FUNCTION public.writes_locked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  -- An unknown level counts as locked, matching lockdownMeta() in the UI:
  -- guessing "probably fine" is the wrong direction to be wrong in.
  SELECT coalesce(
    (SELECT lockdown_level FROM security_settings WHERE id = 1),
    0
  ) >= 2;
$$;
GRANT EXECUTE ON FUNCTION public.writes_locked() TO anon, authenticated;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity
       AND c.relname <> 'security_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Lockdown blocks inserts" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Lockdown blocks updates" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Lockdown blocks deletes" ON public.%I', t);

    IF t NOT IN ('contact_submissions', 'site_visits') THEN
      EXECUTE format(
        'CREATE POLICY "Lockdown blocks inserts" ON public.%I AS RESTRICTIVE
           FOR INSERT WITH CHECK (NOT public.writes_locked())', t);
    END IF;
    EXECUTE format(
      'CREATE POLICY "Lockdown blocks updates" ON public.%I AS RESTRICTIVE
         FOR UPDATE USING (NOT public.writes_locked())', t);
    EXECUTE format(
      'CREATE POLICY "Lockdown blocks deletes" ON public.%I AS RESTRICTIVE
         FOR DELETE USING (NOT public.writes_locked())', t);
  END LOOP;
END $$;

-- Uploads are admin writes too. Scoped to the site bucket so a lockdown here
-- never touches another bucket in the same project.
DROP POLICY IF EXISTS "Lockdown blocks asset uploads" ON storage.objects;
CREATE POLICY "Lockdown blocks asset uploads" ON storage.objects AS RESTRICTIVE
  FOR INSERT WITH CHECK (bucket_id <> 'assets' OR NOT public.writes_locked());
DROP POLICY IF EXISTS "Lockdown blocks asset updates" ON storage.objects;
CREATE POLICY "Lockdown blocks asset updates" ON storage.objects AS RESTRICTIVE
  FOR UPDATE USING (bucket_id <> 'assets' OR NOT public.writes_locked());
DROP POLICY IF EXISTS "Lockdown blocks asset deletes" ON storage.objects;
CREATE POLICY "Lockdown blocks asset deletes" ON storage.objects AS RESTRICTIVE
  FOR DELETE USING (bucket_id <> 'assets' OR NOT public.writes_locked());

-- ── Restore from a workspace backup ─────────────
-- Admin → Security → "Download a backup" writes every owner table to one JSON
-- file; this reads it back. One call, one transaction: the money ledger's
-- balance checks are deferred to commit, so a transaction and its postings
-- have to arrive together, and a restore that fails half-way leaves nothing.
--
-- Merge, never overwrite: rows whose key (or any unique value) already exists
-- are skipped, so restoring into a live workspace only adds what is missing,
-- and restoring twice adds nothing the second time. Rows take the caller as
-- owner, so a backup restores into a new project with a new user id. Only
-- columns present in the backup are written; the rest take their defaults, so
-- an older backup still restores after columns are added.
--
-- SECURITY INVOKER: every row passes the same RLS (owner, AAL2, lockdown) as
-- a write from the app. Table names come from the list below, never from the
-- backup; values are bound, not interpolated.

CREATE OR REPLACE FUNCTION public.workspace_restore_tables()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  -- Parents before children. db/test/30-restore.sql checks this order against
  -- every foreign key in the database.
  SELECT ARRAY[
    'site_identity', 'navigation_links', 'security_settings',
    'portfolio_sections', 'portfolio_items', 'blog_posts',
    'task_projects', 'tasks', 'sub_tasks', 'task_dependencies', 'focus_logs',
    'notes', 'whiteboards', 'thinking_maps',
    'calendars', 'events', 'event_exceptions', 'calendar_settings',
    'learning_subjects', 'learning_topics', 'learning_sessions', 'learning_reviews',
    'habits', 'habit_logs',
    'storage_assets', 'public_notes', 'contact_submissions',
    'discover_watchlist', 'discover_places', 'discover_topics',
    'library_sources', 'library_highlights',
    'money_settings', 'money_institution', 'money_account', 'money_category',
    'money_import_batch', 'money_schedule', 'money_schedule_skip',
    'money_transaction', 'money_posting', 'money_reconciliation', 'money_rule',
    'money_budget', 'money_goal', 'money_goal_account', 'money_loan',
    'money_income_source', 'money_credit_score', 'money_application',
    'money_application_doc', 'money_security', 'money_price', 'money_trade',
    'money_room',
    'inventory_items'
  ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.restore_workspace(backup JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  t TEXT;
  rows JSONB;
  cols TEXT;
  sel TEXT;
  ord TEXT;
  n BIGINT;
  added JSONB := '{}'::JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_aal2() THEN
    RAISE EXCEPTION 'Not authorised' USING ERRCODE = '42501';
  END IF;
  IF backup->>'format' IS DISTINCT FROM 'two.oooo-workspace'
     OR backup->>'version' IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'This file is not a workspace backup this version can read'
      USING ERRCODE = '22023';
  END IF;

  FOREACH t IN ARRAY public.workspace_restore_tables() LOOP
    rows := backup->'tables'->t;
    CONTINUE WHEN rows IS NULL OR jsonb_typeof(rows) <> 'array'
      OR jsonb_array_length(rows) = 0;

    -- Writable columns the backup carries; user_id always, as the caller.
    SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position),
           string_agg(CASE WHEN c.column_name = 'user_id' THEN 'auth.uid()'
                           ELSE 'r.' || quote_ident(c.column_name) END,
                      ', ' ORDER BY c.ordinal_position)
      INTO cols, sel
      FROM information_schema.columns c
     WHERE c.table_schema = 'public'
       AND c.table_name = t
       AND c.is_generated = 'NEVER'
       AND (c.column_name = 'user_id'
            OR c.column_name IN (SELECT jsonb_object_keys(rows->0)));
    CONTINUE WHEN cols IS NULL;

    -- A subcategory's parent is checked as it is inserted, so parents first.
    ord := CASE WHEN t = 'money_category' THEN ' ORDER BY r.parent_id NULLS FIRST' ELSE '' END;

    EXECUTE format(
      'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) r%s ON CONFLICT DO NOTHING',
      t, cols, sel, t, ord)
    USING rows;
    GET DIAGNOSTICS n = ROW_COUNT;
    added := added || jsonb_build_object(t, n);
  END LOOP;

  RETURN added;
END $$;

REVOKE ALL ON FUNCTION public.restore_workspace(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_workspace(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_restore_tables() TO authenticated;
