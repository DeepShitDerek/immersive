-- db/john-doe.sample.sql
--
-- FolioKit's sample person: John Doe, a made-up full-stack engineer.
-- Every name, employer, number and address in this file is invented; nobody
-- here is real. It is the same person as portfolio.config.ts, loaded into a
-- Supabase project so you can see the public site and the private workspace
-- with something in them.
--
-- HOW TO RUN
--   1. Run db/schema.sql in the Supabase SQL editor.
--   2. Open the site at /admin and create your account (the first account is
--      the owner; the workspace data below is filed under it).
--   3. Run this file in the SQL editor.
--
-- WHAT IT DOES
--   Part A, the public site: REPLACES it. Site identity, navigation, every
--   page section and its items, blog posts and updates are deleted and
--   written again. Do not run this on a site whose content you want to keep.
--
--   Part B, the private workspace: ONLY ADDS. Tasks, notes, calendar, habits,
--   learning, library, inventory, inbox and money rows are inserted with
--   fixed ids and skipped if they already exist. Nothing of yours is changed
--   or removed, and running the file twice adds nothing the second time. The
--   money ledger is only written when it has no transactions at all.
--
-- Dates are relative to the day you run it, so the workspace looks current.
-- Not seeded: whiteboards, maps, uploaded files and visitor analytics
-- (db/seed-site-visits.sql has sample analytics).

BEGIN;

-- =========================================================
-- 0. THE OWNER
-- =========================================================
-- The SQL editor runs as the database owner, with no signed-in user. The
-- workspace tables file every row under auth.uid(), and the money ledger is
-- written through the same functions the app calls, which check for a
-- signed-in, two-factor session. So for the length of this transaction the
-- script acts as the site's owner: the first account ever created.
DO $$
DECLARE
  owner UUID;
BEGIN
  SELECT id INTO owner FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF owner IS NULL THEN
    RAISE EXCEPTION 'No account yet. Open the site at /admin, create your account, then run this file again.';
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', owner, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
END $$;


-- #########################################################
-- PART A: THE PUBLIC SITE  (replaced)
-- #########################################################

DELETE FROM portfolio_sections;   -- cascades to portfolio_items
DELETE FROM navigation_links;
DELETE FROM blog_posts;
DELETE FROM public_notes;

-- =========================================================
-- A1. SITE IDENTITY  (single row, id = 1)
-- =========================================================
INSERT INTO site_identity (id, profile_data, social_links, footer_data, portfolio_mode)
VALUES (
  1,
  $json$
  {
    "name": "John Doe",
    "title": "Full-Stack Engineer",
    "description": "Web products from first sketch to production: clear interfaces, dependable APIs, and the unglamorous work that keeps both fast.",
    "headline": "I build web products that stay fast after the launch party.",
    "proof": [
      { "value": "40%", "label": "faster checkout after the Northwind rebuild" },
      { "value": "7 yrs", "label": "shipping production web software" },
      { "value": "12", "label": "products launched, from MVP to scale" },
      { "value": "99.95%", "label": "uptime on the last platform I ran" }
    ],
    "profile_picture_url": "https://github.com/octocat.png",
    "show_profile_picture": true,
    "default_theme": "theme-field-notes-light",
    "typography_preset": "typo-modern-editorial",
    "updates_layout": "scrapbook",
    "logo": { "main": "john", "highlight": ".dev" },
    "bio": [
      "I'm a full-stack engineer with seven years of turning ideas into products people use every day. At Northwind Labs I led the rebuild of a checkout that had grown slow and fragile; the new one is 40% faster and has not paged anyone at night since.",
      "I started on the front end, moved to APIs because I wanted to fix the slow parts myself, and now work across both. I care about boring things done well: schemas that make bad states impossible, interfaces that work with a keyboard, and deploys nobody has to watch."
    ],
    "status_panel": {
      "show": true,
      "design": "minimal",
      "title": "Current Status",
      "availability": "Open to senior full-stack roles and select contracts",
      "currently_exploring": {
        "title": "Learning",
        "items": ["Rust", "Local-first sync", "Postgres internals"]
      },
      "latestProject": {
        "name": "Taskflow — a keyboard-first task manager",
        "linkText": "See the work",
        "href": "/work"
      }
    },
    "github_projects_config": {
      "username": "octocat",
      "show": true,
      "sort_by": "pushed",
      "exclude_forks": true,
      "exclude_archived": true,
      "exclude_profile_repo": true,
      "min_stars": 0,
      "projects_per_page": 6
    },
    "contact_page": {
      "show_contact_form": true,
      "show_availability_badge": true,
      "show_services": true
    }
  }
  $json$::jsonb,
  $json$
  [
    { "id": "email",    "label": "Email",    "url": "mailto:john@example.com",               "is_visible": true },
    { "id": "github",   "label": "GitHub",   "url": "https://github.com/octocat",            "is_visible": true },
    { "id": "linkedin", "label": "LinkedIn", "url": "https://example.com/linkedin/john-doe", "is_visible": true }
  ]
  $json$::jsonb,
  $json$
  {
    "copyright_text": "Built with Next.js & Supabase · Anytown",
    "links": [{ "label": "Updates", "href": "/updates" }]
  }
  $json$::jsonb,
  'multi-page'
)
ON CONFLICT (id) DO UPDATE SET
  profile_data   = EXCLUDED.profile_data,
  social_links   = EXCLUDED.social_links,
  footer_data    = EXCLUDED.footer_data,
  portfolio_mode = EXCLUDED.portfolio_mode;

-- =========================================================
-- A2. NAVIGATION
-- =========================================================
-- The /contact link is drawn as the header's call to action.
INSERT INTO navigation_links (label, href, display_order, is_visible) VALUES
  ('Work',         '/work',    1, true),
  ('About',        '/about',   2, true),
  ('Writing',      '/blog',    3, true),
  ('Work with me', '/contact', 4, true);

-- =========================================================
-- A3. PAGE SECTIONS
-- =========================================================
INSERT INTO portfolio_sections (id, title, type, page_path, layout_style, display_order, is_visible) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'What I do',         'list_items', '/',        'services',            1, true),
  ('a1000000-0000-4000-8000-000000000002', 'How I work',        'list_items', '/',        'process',             2, true),
  ('a1000000-0000-4000-8000-000000000003', 'Toolkit',           'list_items', '/',        'compact-cards',       3, true),
  ('a1000000-0000-4000-8000-000000000004', 'Selected work',     'list_items', '/work',    'case-study',          1, true),
  ('a1000000-0000-4000-8000-000000000005', 'Featured Projects', 'list_items', '/work',    'feature-alternating', 2, true),
  ('a1000000-0000-4000-8000-000000000006', 'Experience',        'list_items', '/about',   'timeline',            1, true),
  ('a1000000-0000-4000-8000-000000000007', 'Education',         'list_items', '/about',   'timeline',            2, true),
  ('a1000000-0000-4000-8000-000000000008', 'Tools',             'list_items', '/about',   'compact-cards',       3, true),
  ('a1000000-0000-4000-8000-000000000009', 'What I can do for you', 'list_items', '/contact', 'services',        1, true);

-- ── Home: What I do ──────────────────────────────────────
INSERT INTO portfolio_items (section_id, title, subtitle, description, tags, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000001', 'Product engineering', 'React · Next.js · Node.js',
   'A feature or a whole product, taken from a rough brief to something your customers use: front end, API, database and deploy.',
   ARRAY['Web apps', 'APIs', 'Auth', 'Deployment'], 1),
  ('a1000000-0000-4000-8000-000000000001', 'Performance & reliability', 'Profiling · Caching · Observability',
   'Finding why it is slow or flaky, fixing the cause, and leaving the dashboards and alerts that keep it fixed.',
   ARRAY['Core Web Vitals', 'Query tuning', 'On-call'], 2),
  ('a1000000-0000-4000-8000-000000000001', 'Accessibility audits', 'WCAG 2.2 AA',
   'A review of your product against WCAG with a prioritised list of fixes, and help making them.',
   ARRAY['Audits', 'Keyboard', 'Screen readers'], 3);

-- ── Home: How I work ─────────────────────────────────────
INSERT INTO portfolio_items (section_id, title, subtitle, description, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000002', 'Discovery call', '30 minutes',
   'What you''re trying to change, what you have today, and whether I''m the right person for it.', 1),
  ('a1000000-0000-4000-8000-000000000002', 'Scoped proposal', 'A few days',
   'A written plan: the smallest version worth shipping, what it takes, and how we''ll know it worked.', 2),
  ('a1000000-0000-4000-8000-000000000002', 'Build in the open', 'Weekly demos',
   'Working software every week against your real data, so you can steer while changes are still cheap.', 3),
  ('a1000000-0000-4000-8000-000000000002', 'Ship and hand over', 'Launch',
   'Deployed, monitored and documented, with your team able to run it without me.', 4);

-- ── Home: Toolkit ────────────────────────────────────────
INSERT INTO portfolio_items (section_id, title, description, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000003', 'TypeScript / React / Next.js', 'Product front ends, from design system to deploy', 1),
  ('a1000000-0000-4000-8000-000000000003', 'Node.js & Python',             'APIs, background jobs and the glue between systems', 2),
  ('a1000000-0000-4000-8000-000000000003', 'PostgreSQL',                   'Schema design, query tuning, row-level security', 3),
  ('a1000000-0000-4000-8000-000000000003', 'AWS & Docker',                 'Containers, queues and infrastructure as code', 4),
  ('a1000000-0000-4000-8000-000000000003', 'Testing',                      'Unit, integration and browser tests that earn their keep', 5),
  ('a1000000-0000-4000-8000-000000000003', 'Accessibility',                'WCAG 2.2 AA as a build requirement, not a retrofit', 6);

-- ── Work: Selected work (each with a case study at /work/<slug>/) ──
INSERT INTO portfolio_items (section_id, title, subtitle, date_from, date_to, description, link_url, tags, slug, case_study, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000004', 'Northwind checkout rebuild', 'Northwind Labs · Lead engineer', '2023', '2024',
   'A checkout that had grown slow and fragile, rebuilt in place without a day of downtime. Median time to pay fell by 40% and abandoned carts by a fifth.',
   'https://example.com/northwind',
   ARRAY['Next.js', 'PostgreSQL', 'Payments', 'Performance'],
   'northwind-checkout-rebuild',
$md$## The problem

Northwind's checkout had been patched for six years. Paying took a median of 9.4 seconds, one order in forty failed and had to be retried, and nobody wanted to be on call for it.

## What I did

- **Measured first.** Tracing showed most of the wait was four database round trips that could have been one, not rendering and not the network.
- **Rebuilt it in place.** The new checkout ran beside the old one behind a flag, taking 1% of orders, then 10%, then all of them. There was no switch-over night.
- **Moved the rules into the database.** Stock, pricing and order state are now enforced by constraints, so a bug in one service cannot write an impossible order.

## The result

| | Before | After |
|---|---|---|
| Median time to pay | 9.4 s | 5.6 s |
| Failed orders | 2.5% | 0.3% |
| Pages to on-call, per month | 11 | 0 |

## What I would do differently

I would put the dashboards in place before the first line of the rebuild, not half-way through. The first month of comparisons was guesswork.
$md$, 1),
  ('a1000000-0000-4000-8000-000000000004', 'Acme dashboard builder', 'Acme Analytics · Full-stack engineer', '2020', '2021',
   'A drag-and-drop report editor over a query planner that keeps large reports interactive. Report load time went from eight seconds to under one.',
   'https://example.com/acme',
   ARRAY['React', 'FastAPI', 'ClickHouse', 'Data'],
   'acme-dashboard-builder',
$md$## The problem

Customers could only see their data through reports an analyst built for them. The queue for a new report was three weeks.

## What I did

- **An editor people could learn in a minute.** Charts are dragged onto a grid; every chart is a question in plain words, not a query.
- **A planner behind it.** The same question is answered from a rollup when one exists and from raw events when it does not, and the editor never has to know which.
- **Keyboard and screen-reader support from the first version**, because an editor that only works with a mouse is half an editor.

## The result

- Report load time: 8 seconds to under 1.
- Three quarters of new reports are now built by customers themselves.
- The analyst queue went from three weeks to two days.
$md$, 2);

-- ── Work: Featured projects ──────────────────────────────
INSERT INTO portfolio_items (section_id, title, subtitle, description, link_url, tags, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000005', 'Taskflow', 'A keyboard-first task manager',
   'Tasks, projects and a daily plan you can drive without touching the mouse. Works offline and syncs when it can.',
   'https://example.com/taskflow', ARRAY['TypeScript', 'Local-first', 'PWA'], 1),
  ('a1000000-0000-4000-8000-000000000005', 'Pingboard', 'Uptime checks you can read at a glance',
   'A small self-hosted monitor: checks every minute, one status page, alerts that say what broke.',
   'https://example.com/pingboard', ARRAY['Go', 'SQLite', 'Monitoring'], 2),
  ('a1000000-0000-4000-8000-000000000005', 'Markleaf', 'Markdown notes that stay plain files',
   'A notes app that never locks your writing in: plain Markdown on disk, fast search on top.',
   'https://example.com/markleaf', ARRAY['Rust', 'Tauri', 'Search'], 3);

-- ── About: Experience ────────────────────────────────────
INSERT INTO portfolio_items (section_id, title, subtitle, date_from, date_to, description, tags, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000006', 'Senior Full-Stack Engineer', 'Northwind Labs', 'Mar 2022', 'Present',
   'Led the rebuild of the checkout and order pipeline for a marketplace handling 30,000 orders a day. Cut median checkout time by 40%, moved the team to trunk-based releases, and wrote the runbooks the on-call rota still uses.',
   ARRAY['TypeScript', 'Next.js', 'PostgreSQL', 'Node.js', 'AWS'], 1),
  ('a1000000-0000-4000-8000-000000000006', 'Full-Stack Engineer', 'Acme Analytics', 'Jun 2019', 'Feb 2022',
   'Built the dashboard builder customers use to explore their own data: a drag-and-drop editor on the front, a query planner behind it. Took report load times from eight seconds to under one.',
   ARRAY['React', 'Python', 'FastAPI', 'ClickHouse'], 2),
  ('a1000000-0000-4000-8000-000000000006', 'Front-End Developer', 'Contoso Studio', 'Aug 2017', 'May 2019',
   'Shipped marketing sites and web apps for a dozen clients. Introduced the studio''s first component library and its accessibility checklist.',
   ARRAY['JavaScript', 'Vue', 'Sass', 'Accessibility'], 3);

-- ── About: Education ─────────────────────────────────────
INSERT INTO portfolio_items (section_id, title, subtitle, date_from, date_to, description, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000007', 'BSc, Computer Science', 'Example State University', 'Sep 2013', 'Jun 2017',
   'First-class honours. Final-year project on offline-first web applications.', 1),
  ('a1000000-0000-4000-8000-000000000007', 'Certificate, Web Accessibility', 'Example Institute of Technology', 'Jan 2020', 'Apr 2020',
   'WCAG auditing, assistive technology and inclusive design.', 2);

-- ── About: Tools ─────────────────────────────────────────
INSERT INTO portfolio_items (section_id, title, description, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000008', 'Figma',          'Reading designs and prototyping changes.', 1),
  ('a1000000-0000-4000-8000-000000000008', 'Playwright',     'Browser tests for the flows that must not break.', 2),
  ('a1000000-0000-4000-8000-000000000008', 'Grafana',        'Dashboards and alerts for what ships.', 3),
  ('a1000000-0000-4000-8000-000000000008', 'GitHub Actions', 'Build, test and deploy on every push.', 4);

-- ── Contact: Services ────────────────────────────────────
INSERT INTO portfolio_items (section_id, title, subtitle, description, tags, display_order) VALUES
  ('a1000000-0000-4000-8000-000000000009', 'Product engineering', 'React · Next.js · Node.js',
   'A feature or a whole product, from a rough brief to something your customers use.',
   ARRAY['Web apps', 'APIs', 'Deployment'], 1),
  ('a1000000-0000-4000-8000-000000000009', 'Performance & reliability', 'Profiling · Caching · Observability',
   'Finding why it is slow or flaky and fixing the cause.',
   ARRAY['Core Web Vitals', 'Query tuning'], 2),
  ('a1000000-0000-4000-8000-000000000009', 'Accessibility audits', 'WCAG 2.2 AA',
   'A review against WCAG with a prioritised list of fixes.',
   ARRAY['Audits', 'Keyboard'], 3);

-- =========================================================
-- A4. BLOG POSTS  (three published, one draft)
-- =========================================================
INSERT INTO blog_posts (title, slug, excerpt, content, published, published_at, show_toc, tags) VALUES
  ('What a 40% faster checkout actually took', 'what-a-faster-checkout-took',
   'No rewrite, no new framework. Three boring changes did almost all of it, and the fourth we tried made things worse.',
$md$## Where the time went

Before touching anything we measured. Most of the wait was not rendering or the network: it was four database round trips that could have been one.

## The three changes

- One query for the cart instead of four
- Prices computed once, on the server
- The payment form loaded before the customer asks for it

## The change that made it worse

We added a cache in front of stock levels. It was fast, and it was wrong often enough to oversell. We took it out.

## What I'd do again

Measure first, change one thing at a time, and keep the dashboard open while you do.
$md$, true, now() - interval '9 days', true, ARRAY['Performance', 'PostgreSQL', 'Checkout']),

  ('Schemas that make bad states impossible', 'schemas-that-make-bad-states-impossible',
   'Every validation you write in application code is one a second service will forget. Put the rule where the data lives.',
$md$## The bug that started it

An order with a negative quantity reached the warehouse. Three services had a check for it; a fourth, written later, did not.

## Constraints are documentation that runs

A `CHECK (quantity > 0)` cannot be forgotten by the next service.

```sql
ALTER TABLE order_lines
  ADD CONSTRAINT quantity_positive CHECK (quantity > 0);
```

## When not to

Rules that change every quarter belong in code. Rules that are true by definition belong in the schema.
$md$, true, now() - interval '34 days', true, ARRAY['PostgreSQL', 'Data modelling']),

  ('A keyboard is the best accessibility test you own', 'keyboard-accessibility-test',
   'Unplug the mouse for ten minutes. Most of what an audit would find, you will find first.',
$md$## Ten minutes, no mouse

Tab through your own product. Can you see where you are? Can you reach everything? Can you get out of the dialog you opened?

## What it catches

- Focus that disappears
- Controls that are only clickable
- Menus that trap you

## What it does not

Contrast, alternative text and reading order still need their own checks.
$md$, true, now() - interval '71 days', false, ARRAY['Accessibility', 'Testing']),

  ('Notes on local-first sync', 'notes-on-local-first-sync',
   'A draft: what I have learned so far, and what I still do not understand.',
$md$## Draft

- Conflicts are a product decision before they are an engineering one
- What "offline" means to a user versus to the app
$md$, false, NULL, false, ARRAY['Local-first']);

-- =========================================================
-- A5. UPDATES
-- =========================================================
INSERT INTO public_notes (title, content, category, tags, is_pinned, is_published, created_at) VALUES
  ('The Northwind checkout is live',
   'Eight months of work, switched over on a Tuesday afternoon with nobody watching a dashboard in fear. 40% faster, and quieter.',
   'milestone', ARRAY['Launch', 'Performance'], true, true, now() - interval '12 days'),
  ('Learning Rust by rewriting Markleaf''s search',
   'The borrow checker and I have reached an understanding. Search over ten thousand notes now answers before the key comes back up.',
   'activity', ARRAY['Rust', 'Side project'], false, true, now() - interval '5 days'),
  ('A note on estimates',
   'An estimate is a range, not a number. The honest ones come with what would make them wrong.',
   'thought', ARRAY['Engineering'], false, true, now() - interval '20 days'),
  ('Watching: a talk on Postgres query plans',
   'An hour on how the planner chooses an index. I have been reading EXPLAIN output wrong for years.',
   'watching', ARRAY['PostgreSQL'], false, true, now() - interval '41 days'),
  ('Spoke at the Anytown web meetup',
   'Twenty minutes on keyboard testing, to a room that mostly had not tried it. Three people unplugged their mouse on the spot.',
   'milestone', ARRAY['Speaking', 'Accessibility'], false, true, now() - interval '66 days'),
  ('Draft: things I changed my mind about this year',
   'Not ready yet.',
   'thought', ARRAY['Engineering'], false, false, now() - interval '2 days');


-- #########################################################
-- PART B: THE PRIVATE WORKSPACE  (added, never replaced)
-- #########################################################
-- Every row has a fixed id and ON CONFLICT DO NOTHING, so a second run adds
-- nothing and nothing of yours is touched.

-- =========================================================
-- B1. TASKS
-- =========================================================
INSERT INTO task_projects (id, name, color, display_order) VALUES
  ('b1000000-0000-4000-8000-000000000001', 'Northwind', '#2563eb', 1),
  ('b1000000-0000-4000-8000-000000000002', 'Markleaf',  '#16a34a', 2),
  ('b1000000-0000-4000-8000-000000000003', 'Home',      '#d97706', 3)
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, project_id, title, description, status, priority, start_date, due_date, tags, display_order, estimate_minutes, completed_at) VALUES
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Write the checkout post-mortem',
   'Timeline, what went well, what to change. Share with the team before Friday.', 'inprogress', 'high', current_date - 1, current_date + 1, ARRAY['writing'], 1, 90, NULL),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Review the payments retry change',
   NULL, 'todo', 'high', NULL, current_date, ARRAY['review'], 2, 45, NULL),
  ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'Add an alert for failed orders above 1%',
   'Page only when it stays above the line for five minutes.', 'todo', 'medium', NULL, current_date + 3, ARRAY['observability'], 3, 60, NULL),
  ('b2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'Remove the old checkout feature flag',
   NULL, 'review', 'low', NULL, current_date + 6, ARRAY['cleanup'], 4, 30, NULL),
  ('b2000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001', 'Ship the order status page',
   NULL, 'done', 'medium', NULL, current_date - 2, ARRAY['frontend'], 5, 120, now() - interval '2 days'),
  ('b2000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000002', 'Benchmark search on 10,000 notes',
   'Record the numbers before and after the index change.', 'inprogress', 'medium', NULL, current_date + 2, ARRAY['rust', 'performance'], 1, 60, NULL),
  ('b2000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000002', 'Draft the "Notes on local-first sync" post',
   NULL, 'todo', 'low', NULL, current_date + 10, ARRAY['writing'], 2, 120, NULL),
  ('b2000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000003', 'Renew the home insurance',
   'The renewal letter is in the Inventory notes.', 'todo', 'high', NULL, current_date - 1, ARRAY['admin'], 1, 20, NULL),
  ('b2000000-0000-4000-8000-000000000009', 'b1000000-0000-4000-8000-000000000003', 'Book the dentist',
   NULL, 'todo', 'low', NULL, current_date + 14, ARRAY['health'], 2, 10, NULL),
  ('b2000000-0000-4000-8000-000000000010', NULL, 'Reply to Priya about the meetup talk',
   NULL, 'done', 'medium', NULL, current_date, ARRAY['email'], 1, 15, now() - interval '3 hours')
ON CONFLICT DO NOTHING;

INSERT INTO sub_tasks (id, task_id, title, is_completed) VALUES
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Collect the timeline from the incident channel', true),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'Write "what went well"', true),
  ('b3000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 'Write "what to change"', false),
  ('b3000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000006', 'Generate the sample notes', true),
  ('b3000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000006', 'Run before and after', false)
ON CONFLICT DO NOTHING;

-- =========================================================
-- B2. NOTES
-- =========================================================
INSERT INTO notes (id, title, content, color, tags, is_pinned) VALUES
  ('b4000000-0000-4000-8000-000000000001', 'Checkout post-mortem: outline',
$md$## Timeline
- 14:02 flag to 100%
- 14:20 error rate flat, latency down

## Went well
- Rollout by percentage
- Dashboards ready before the switch

## To change
- Write the runbook first next time
$md$, '#2563eb', ARRAY['northwind', 'writing'], true),
  ('b4000000-0000-4000-8000-000000000002', 'Questions for the planning meeting',
   '1. Who owns the retry queue after the handover?' || E'\n' || '2. Can we drop the nightly reconciliation job?' || E'\n' || '3. What is the budget for the status page?',
   NULL, ARRAY['northwind'], false),
  ('b4000000-0000-4000-8000-000000000003', 'Rust: things that finally clicked',
   'Ownership is about who cleans up. Borrowing is about who may look. Lifetimes are the compiler asking how long "look" lasts.',
   '#16a34a', ARRAY['rust', 'learning'], false),
  ('b4000000-0000-4000-8000-000000000004', 'Gift ideas',
   'A good chef''s knife. The book about bridges. A weekend away, not a thing.',
   '#d97706', ARRAY['home'], false)
ON CONFLICT DO NOTHING;

-- =========================================================
-- B3. CALENDAR
-- =========================================================
INSERT INTO calendars (id, name, color_token, is_visible, is_default, sort_order) VALUES
  ('b5000000-0000-4000-8000-000000000001', 'Work',     'chart-1', true, false, 1),
  ('b5000000-0000-4000-8000-000000000002', 'Personal', 'chart-3', true, false, 2)
ON CONFLICT DO NOTHING;

INSERT INTO events (id, calendar_id, title, description, start_time, end_time, is_all_day, location) VALUES
  ('b6000000-0000-4000-8000-000000000001', (SELECT id FROM calendars WHERE name = 'Work' AND user_id = auth.uid()),
   'Team stand-up', NULL,
   date_trunc('day', now()) + interval '9 hours 30 minutes', date_trunc('day', now()) + interval '9 hours 45 minutes', false, NULL),
  ('b6000000-0000-4000-8000-000000000002', (SELECT id FROM calendars WHERE name = 'Work' AND user_id = auth.uid()),
   'Post-mortem review', 'Walk the team through the checkout post-mortem.',
   date_trunc('day', now()) + interval '1 day 14 hours', date_trunc('day', now()) + interval '1 day 15 hours', false, 'Room 2'),
  ('b6000000-0000-4000-8000-000000000003', (SELECT id FROM calendars WHERE name = 'Work' AND user_id = auth.uid()),
   'Planning', NULL,
   date_trunc('day', now()) + interval '3 days 10 hours', date_trunc('day', now()) + interval '3 days 11 hours 30 minutes', false, NULL),
  ('b6000000-0000-4000-8000-000000000004', (SELECT id FROM calendars WHERE name = 'Personal' AND user_id = auth.uid()),
   'Dinner with Sam', NULL,
   date_trunc('day', now()) + interval '2 days 19 hours', date_trunc('day', now()) + interval '2 days 21 hours', false, 'The Corner Table'),
  ('b6000000-0000-4000-8000-000000000005', (SELECT id FROM calendars WHERE name = 'Personal' AND user_id = auth.uid()),
   'Anytown web meetup', 'Speaking: "A keyboard is the best accessibility test you own".',
   date_trunc('day', now()) + interval '8 days 18 hours', date_trunc('day', now()) + interval '8 days 20 hours', false, 'Anytown Library'),
  ('b6000000-0000-4000-8000-000000000006', (SELECT id FROM calendars WHERE name = 'Personal' AND user_id = auth.uid()),
   'Day off', NULL,
   date_trunc('day', now()) + interval '5 days', date_trunc('day', now()) + interval '6 days', true, NULL)
ON CONFLICT DO NOTHING;

-- =========================================================
-- B4. HABITS  (and the last two weeks of check-ins)
-- =========================================================
INSERT INTO habits (id, title, color, kind, target_value, unit, step, schedule, target_per_week, time_of_day, category, display_order) VALUES
  ('b7000000-0000-4000-8000-000000000001', 'Read',            '#2563eb', 'build', 20,   'pages', 5,   'daily',        7, 'evening',   'Mind',   1),
  ('b7000000-0000-4000-8000-000000000002', 'Walk',            '#16a34a', 'build', 8000, 'steps', 500, 'daily',        7, 'anytime',   'Health', 2),
  ('b7000000-0000-4000-8000-000000000003', 'Strength training','#d97706', 'build', 1,    NULL,    1,   'weekly_count', 3, 'morning',   'Health', 3),
  ('b7000000-0000-4000-8000-000000000004', 'No phone in bed', '#7c3aed', 'quit',  1,    NULL,    1,   'daily',        7, 'evening',   'Sleep',  4)
ON CONFLICT DO NOTHING;

-- Reading: most days. Walking: every day, the target met on most.
INSERT INTO habit_logs (habit_id, completed_date, value)
SELECT 'b7000000-0000-4000-8000-000000000001', d::date, 20
FROM generate_series(current_date - 13, current_date - 1, interval '1 day') AS d
WHERE extract(dow FROM d) NOT IN (3)
ON CONFLICT DO NOTHING;

INSERT INTO habit_logs (habit_id, completed_date, value)
SELECT 'b7000000-0000-4000-8000-000000000002', d::date,
       CASE WHEN extract(dow FROM d) IN (0, 6) THEN 11000 ELSE 8000 - 1500 * (extract(day FROM d)::int % 2) END
FROM generate_series(current_date - 13, current_date - 1, interval '1 day') AS d
ON CONFLICT DO NOTHING;

INSERT INTO habit_logs (habit_id, completed_date, value)
SELECT 'b7000000-0000-4000-8000-000000000003', d::date, 1
FROM generate_series(current_date - 13, current_date - 1, interval '1 day') AS d
WHERE extract(dow FROM d) IN (1, 3, 5)
ON CONFLICT DO NOTHING;

INSERT INTO habit_logs (habit_id, completed_date, value)
SELECT 'b7000000-0000-4000-8000-000000000004', d::date, 1
FROM generate_series(current_date - 13, current_date - 1, interval '1 day') AS d
WHERE extract(dow FROM d) NOT IN (5, 6)
ON CONFLICT DO NOTHING;

-- =========================================================
-- B5. LEARNING
-- =========================================================
INSERT INTO learning_subjects (id, name, description, color, target_minutes_per_week, display_order) VALUES
  ('b8000000-0000-4000-8000-000000000001', 'Rust',     'Systems programming, by rewriting Markleaf''s search.', '#d97706', 180, 1),
  ('b8000000-0000-4000-8000-000000000002', 'Postgres', 'How the planner and the storage engine really work.',  '#2563eb', 90,  2)
ON CONFLICT DO NOTHING;

INSERT INTO learning_topics (id, subject_id, title, status, core_notes, confidence_score, ease, interval_days, due_date, last_reviewed_at, review_count, display_order) VALUES
  ('b9000000-0000-4000-8000-000000000001', 'b8000000-0000-4000-8000-000000000001', 'Ownership and borrowing', 'Practicing',
   'Each value has one owner. References borrow: many readers or one writer, never both.', 4, 2.6, 6, current_date + 2, now() - interval '4 days', 5, 1),
  ('b9000000-0000-4000-8000-000000000002', 'b8000000-0000-4000-8000-000000000001', 'Lifetimes', 'Learning',
   'A lifetime names how long a reference is valid. Most are inferred.', 2, 2.3, 1, current_date, now() - interval '1 day', 2, 2),
  ('b9000000-0000-4000-8000-000000000003', 'b8000000-0000-4000-8000-000000000001', 'Traits and generics', 'To Learn',
   NULL, NULL, 2.5, 0, NULL, NULL, 0, 3),
  ('b9000000-0000-4000-8000-000000000004', 'b8000000-0000-4000-8000-000000000002', 'Reading EXPLAIN ANALYZE', 'Mastered',
   'Read from the innermost node out. Compare estimated rows with actual rows first.', 5, 2.8, 30, current_date + 21, now() - interval '9 days', 9, 1),
  ('b9000000-0000-4000-8000-000000000005', 'b8000000-0000-4000-8000-000000000002', 'MVCC and vacuum', 'Learning',
   'Every update writes a new row version. Vacuum reclaims the dead ones.', 3, 2.4, 3, current_date - 1, now() - interval '4 days', 3, 2)
ON CONFLICT DO NOTHING;

INSERT INTO learning_sessions (id, topic_id, start_time, end_time, duration_minutes, journal_notes) VALUES
  ('ba000000-0000-4000-8000-000000000001', 'b9000000-0000-4000-8000-000000000001', now() - interval '4 days 2 hours', now() - interval '4 days 1 hour 15 minutes', 45,
   'Rewrote the tokenizer to borrow instead of clone. Twice as fast.'),
  ('ba000000-0000-4000-8000-000000000002', 'b9000000-0000-4000-8000-000000000002', now() - interval '1 day 3 hours', now() - interval '1 day 2 hours 30 minutes', 30,
   'Lifetimes on structs still feel like guesswork.'),
  ('ba000000-0000-4000-8000-000000000003', 'b9000000-0000-4000-8000-000000000005', now() - interval '4 days 20 hours', now() - interval '4 days 19 hours', 60,
   'Watched a bloated table shrink after a manual vacuum.')
ON CONFLICT DO NOTHING;

-- =========================================================
-- B6. LIBRARY
-- =========================================================
INSERT INTO library_sources (id, kind, title, creator, url, status, rating, notes, started_on, finished_on) VALUES
  ('bb000000-0000-4000-8000-000000000001', 'book',    'Systems That Stay Up', 'Jane Roe', NULL, 'done', 5,
   'A made-up book. The chapter on replication changed how I read incident reports.', current_date - 120, current_date - 60),
  ('bb000000-0000-4000-8000-000000000002', 'book',    'Rust by Rewriting', 'Sam Example', 'https://example.com/rust-by-rewriting', 'in_progress', NULL,
   NULL, current_date - 30, NULL),
  ('bb000000-0000-4000-8000-000000000003', 'article', 'Your data, your files', 'Example Press', 'https://example.com/your-data-your-files', 'done', 4,
   NULL, current_date - 15, current_date - 14),
  ('bb000000-0000-4000-8000-000000000004', 'podcast', 'The Query Plan', NULL, NULL, 'want', NULL,
   'Recommended by Sam.', NULL, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO library_highlights (id, source_id, text, attribution, location, note, is_public, is_favorite) VALUES
  ('bc000000-0000-4000-8000-000000000001', 'bb000000-0000-4000-8000-000000000001',
   'A system that is easy to operate is one whose normal behaviour is visible.', 'Jane Roe', 'ch. 1',
   NULL, false, true),
  ('bc000000-0000-4000-8000-000000000002', 'bb000000-0000-4000-8000-000000000001',
   'Replication lag is not a bug to be fixed but a property to be designed around.', 'Jane Roe', 'ch. 5',
   'Use this in the post-mortem.', false, false),
  ('bc000000-0000-4000-8000-000000000003', 'bb000000-0000-4000-8000-000000000003',
   'The data should outlive the software that made it.', 'Example Press', NULL,
   'Marked public: it can appear on the Updates page.', true, true),
  ('bc000000-0000-4000-8000-000000000004', 'bb000000-0000-4000-8000-000000000002',
   'If it compiles, the hard part is usually over.', 'Sam Example', 'ch. 4',
   NULL, false, false)
ON CONFLICT DO NOTHING;

-- =========================================================
-- B7. INVENTORY
-- =========================================================
INSERT INTO inventory_items (id, name, category, serial_number, purchase_date, warranty_expiry, purchase_price, current_value, currency, notes, location, quantity, tags) VALUES
  ('bd000000-0000-4000-8000-000000000001', 'Laptop, 14-inch',         'Electronics', 'SN-EXAMPLE-0001', current_date - 400, current_date + 330, 2400.00, 1700.00, 'CAD',
   'Work machine. Receipt in the Assets folder.', 'Desk', 1, ARRAY['work']),
  ('bd000000-0000-4000-8000-000000000002', 'Monitor, 27-inch',        'Electronics', 'SN-EXAMPLE-0002', current_date - 700, current_date + 30,  650.00,  380.00,  'CAD',
   'Warranty ends next month.', 'Desk', 1, ARRAY['work']),
  ('bd000000-0000-4000-8000-000000000003', 'Standing desk',           'Furniture',   NULL,              current_date - 900, NULL,               780.00,  450.00,  'CAD',
   NULL, 'Office', 1, ARRAY['home']),
  ('bd000000-0000-4000-8000-000000000004', 'Noise-cancelling headphones', 'Electronics', 'SN-EXAMPLE-0004', current_date - 200, current_date + 165, 420.00,  300.00,  'CAD',
   NULL, 'Bag', 1, ARRAY['travel']),
  ('bd000000-0000-4000-8000-000000000005', 'USB-C cables',            'Accessories', NULL,              current_date - 150, NULL,               15.00,   10.00,   'CAD',
   NULL, 'Drawer', 4, ARRAY['spares'])
ON CONFLICT DO NOTHING;

-- =========================================================
-- B8. DISCOVER
-- =========================================================
INSERT INTO discover_watchlist (id, symbol, name, kind, exchange, currency, note, display_order) VALUES
  ('be000000-0000-4000-8000-000000000001', 'VEQT', 'All-equity index ETF',  'etf',   'TSX',    'CAD', 'The one I actually hold.', 1),
  ('be000000-0000-4000-8000-000000000002', 'XBB',  'Canadian bond index ETF', 'etf', 'TSX',    'CAD', NULL, 2),
  ('be000000-0000-4000-8000-000000000003', 'MSFT', 'Microsoft',             'stock', 'NASDAQ', 'USD', 'Watching, not holding.', 3)
ON CONFLICT DO NOTHING;

INSERT INTO discover_places (id, label, latitude, longitude, timezone, sort_order) VALUES
  ('bf000000-0000-4000-8000-000000000001', 'Toronto', 43.6532, -79.3832, 'America/Toronto', 1),
  ('bf000000-0000-4000-8000-000000000002', 'London',  51.5072, -0.1276,  'Europe/London',   2)
ON CONFLICT DO NOTHING;

INSERT INTO discover_topics (id, term, source, sort_order) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'rust',          'hackernews', 1),
  ('c0000000-0000-4000-8000-000000000002', 'postgres',      'hackernews', 2),
  ('c0000000-0000-4000-8000-000000000003', 'accessibility', 'devto',      3)
ON CONFLICT DO NOTHING;

-- =========================================================
-- B9. INBOX  (messages from the public contact form)
-- =========================================================
INSERT INTO contact_submissions (id, name, email, subject, message, topic, is_read, created_at) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'Priya Example', 'priya@example.com', 'Speaking at the Anytown meetup',
   'Hi John, we would love to have you back in the spring. Would a talk on local-first apps work for you?', 'other', false, now() - interval '5 hours'),
  ('c1000000-0000-4000-8000-000000000002', 'Morgan Example', 'morgan@example.org', 'Senior engineer role at Fabrikam',
   'We are building a payments team and your checkout write-up is exactly the experience we are looking for. Are you open to a conversation?', 'role', false, now() - interval '2 days'),
  ('c1000000-0000-4000-8000-000000000003', 'Alex Example', 'alex@example.net', 'Accessibility audit for our booking flow',
   'Our booking flow fails a keyboard test half-way through. Could you look at it and tell us how big the job is?', 'project', true, now() - interval '6 days')
ON CONFLICT DO NOTHING;

-- =========================================================
-- B10. MONEY
-- =========================================================
-- Amounts are in minor units (cents). The figures are round and invented.
INSERT INTO money_settings (user_id, base_currency, home_currency, province, needs_pct, wants_pct, save_pct, emergency_months)
VALUES (auth.uid(), 'CAD', 'USD', 'ON', 50, 30, 20, 6)
ON CONFLICT DO NOTHING;

INSERT INTO money_institution (id, name, country) VALUES
  ('c2000000-0000-4000-8000-000000000001', 'Example Bank', 'CA')
ON CONFLICT DO NOTHING;

INSERT INTO money_account (id, institution_id, name, kind, registration, country, currency, opening_balance_minor, opening_date, credit_limit_minor, sort_order) VALUES
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'Everyday chequing', 'chequing',    'none', 'CA', 'CAD', 420000,   current_date - 120, NULL,    1),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000001', 'Rainy-day savings', 'savings',     'none', 'CA', 'CAD', 1500000,  current_date - 120, NULL,    2),
  ('c3000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', 'Rewards card',      'credit_card', 'none', 'CA', 'CAD', 0,        current_date - 120, 800000,  3)
ON CONFLICT DO NOTHING;

INSERT INTO money_category (id, name, bucket, is_essential, sort_order) VALUES
  ('c4000000-0000-4000-8000-000000000001', 'Salary',        'income', false, 1),
  ('c4000000-0000-4000-8000-000000000002', 'Rent',          'need',   true,  2),
  ('c4000000-0000-4000-8000-000000000003', 'Groceries',     'need',   true,  3),
  ('c4000000-0000-4000-8000-000000000004', 'Utilities',     'need',   true,  4),
  ('c4000000-0000-4000-8000-000000000005', 'Eating out',    'want',   false, 5),
  ('c4000000-0000-4000-8000-000000000006', 'Subscriptions', 'want',   false, 6)
ON CONFLICT DO NOTHING;

INSERT INTO money_income_source (id, name, employment, role, gross_annual_minor, currency, start_date, country) VALUES
  ('c5000000-0000-4000-8000-000000000001', 'Northwind Labs', 'full_time', 'Senior Full-Stack Engineer', 13200000, 'CAD', current_date - 900, 'CA')
ON CONFLICT DO NOTHING;

INSERT INTO money_goal (id, name, target_minor, currency, target_date, notes, sort_order) VALUES
  ('c6000000-0000-4000-8000-000000000001', 'Six months of expenses', 2400000, 'CAD', current_date + 240, 'The emergency fund.', 1)
ON CONFLICT DO NOTHING;

INSERT INTO money_goal_account (goal_id, account_id) VALUES
  ('c6000000-0000-4000-8000-000000000001', 'c3000000-0000-4000-8000-000000000002')
ON CONFLICT DO NOTHING;

INSERT INTO money_budget (category_id, from_month, amount_minor)
SELECT c.id, date_trunc('month', current_date - 90)::date, v.amount
FROM (VALUES ('Groceries', 60000), ('Eating out', 25000), ('Subscriptions', 6000)) AS v(name, amount)
JOIN money_category c ON c.name = v.name AND c.user_id = auth.uid() AND c.parent_id IS NULL
ON CONFLICT DO NOTHING;

-- The ledger: three months of pay, rent, bills and spending, a monthly move
-- to savings and a card payment. Written through money_record_transaction,
-- the function the app itself uses, so every rule of the ledger is applied.
-- Only when the ledger is empty: it is never added to twice.
DO $$
DECLARE
  chequing UUID; savings UUID; card UUID;
  salary UUID; rent UUID; groceries UUID; utilities UUID; eating UUID; subs UUID;
  m INT;
  month_start DATE;
  spent BIGINT;
BEGIN
  IF EXISTS (SELECT 1 FROM money_transaction WHERE user_id = auth.uid()) THEN
    RAISE NOTICE 'The money ledger already has transactions; the sample ledger was not added.';
    RETURN;
  END IF;

  SELECT id INTO chequing FROM money_account WHERE user_id = auth.uid() AND name = 'Everyday chequing';
  SELECT id INTO savings  FROM money_account WHERE user_id = auth.uid() AND name = 'Rainy-day savings';
  SELECT id INTO card     FROM money_account WHERE user_id = auth.uid() AND name = 'Rewards card';
  SELECT id INTO salary    FROM money_category WHERE user_id = auth.uid() AND name = 'Salary';
  SELECT id INTO rent      FROM money_category WHERE user_id = auth.uid() AND name = 'Rent';
  SELECT id INTO groceries FROM money_category WHERE user_id = auth.uid() AND name = 'Groceries';
  SELECT id INTO utilities FROM money_category WHERE user_id = auth.uid() AND name = 'Utilities';
  SELECT id INTO eating    FROM money_category WHERE user_id = auth.uid() AND name = 'Eating out';
  SELECT id INTO subs      FROM money_category WHERE user_id = auth.uid() AND name = 'Subscriptions';
  IF chequing IS NULL OR savings IS NULL OR card IS NULL OR salary IS NULL THEN
    RAISE NOTICE 'The sample accounts or categories are missing; the sample ledger was not added.';
    RETURN;
  END IF;

  -- Three whole months back, oldest first, then this month up to today.
  FOR m IN REVERSE 3..0 LOOP
    month_start := (date_trunc('month', current_date) - make_interval(months => m))::date;
    -- Nothing is dated before the accounts opened, or in the future.
    IF month_start + 27 < current_date - 119 THEN CONTINUE; END IF;
    spent := 0;

    IF month_start + 0 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start, 'kind', 'expense', 'description', 'Rent', 'payee', 'Anytown Lettings', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', chequing, 'category_id', rent, 'amount_minor', -210000)));
    END IF;
    IF month_start + 14 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 14, 'kind', 'income', 'description', 'Pay', 'payee', 'Northwind Labs', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', chequing, 'category_id', salary, 'amount_minor', 390000)));
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 14, 'kind', 'transfer', 'description', 'To savings', 'status', 'cleared'),
        jsonb_build_array(
          jsonb_build_object('account_id', chequing, 'amount_minor', -60000),
          jsonb_build_object('account_id', savings,  'amount_minor', 60000)));
    END IF;
    IF month_start + 27 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 27, 'kind', 'income', 'description', 'Pay', 'payee', 'Northwind Labs', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', chequing, 'category_id', salary, 'amount_minor', 390000)));
    END IF;
    IF month_start + 4 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 4, 'kind', 'expense', 'description', 'Electricity and internet', 'payee', 'Anytown Utilities', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', chequing, 'category_id', utilities, 'amount_minor', -16500)));
    END IF;
    -- Card spending through the month.
    IF month_start + 6 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 6, 'kind', 'expense', 'description', 'Weekly shop', 'payee', 'Corner Market', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', card, 'category_id', groceries, 'amount_minor', -14200 - 300 * m)));
      spent := spent + 14200 + 300 * m;
    END IF;
    IF month_start + 9 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 9, 'kind', 'expense', 'description', 'Music and video', 'payee', 'Streaming Co', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', card, 'category_id', subs, 'amount_minor', -2800)));
      spent := spent + 2800;
    END IF;
    IF month_start + 13 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 13, 'kind', 'expense', 'description', 'Weekly shop', 'payee', 'Corner Market', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', card, 'category_id', groceries, 'amount_minor', -13100)));
      spent := spent + 13100;
    END IF;
    IF month_start + 17 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 17, 'kind', 'expense', 'description', 'Dinner with Sam', 'payee', 'The Corner Table', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', card, 'category_id', eating, 'amount_minor', -8600 - 400 * m)));
      spent := spent + 8600 + 400 * m;
    END IF;
    IF month_start + 20 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 20, 'kind', 'expense', 'description', 'Weekly shop', 'payee', 'Corner Market', 'status', 'cleared'),
        jsonb_build_array(jsonb_build_object('account_id', card, 'category_id', groceries, 'amount_minor', -15300)));
      spent := spent + 15300;
    END IF;
    -- Pay the card in full from chequing near the end of the month.
    IF spent > 0 AND month_start + 25 BETWEEN current_date - 119 AND current_date THEN
      PERFORM public.money_record_transaction(
        jsonb_build_object('date', month_start + 25, 'kind', 'transfer', 'description', 'Pay the card', 'status', 'cleared'),
        jsonb_build_array(
          jsonb_build_object('account_id', chequing, 'amount_minor', -spent),
          jsonb_build_object('account_id', card,     'amount_minor', spent)));
    END IF;
  END LOOP;
END $$;

COMMIT;

-- =========================================================
-- CHECK  (optional: run after the file, signed in or in the SQL editor)
-- =========================================================
-- SELECT 'navigation_links' AS what, count(*) FROM navigation_links        -- 4
-- UNION ALL SELECT 'portfolio_sections', count(*) FROM portfolio_sections  -- 9
-- UNION ALL SELECT 'portfolio_items',    count(*) FROM portfolio_items     -- 30
-- UNION ALL SELECT 'case studies',       count(*) FROM portfolio_items WHERE has_case_study  -- 2
-- UNION ALL SELECT 'blog_posts',         count(*) FROM blog_posts          -- 4 (3 published)
-- UNION ALL SELECT 'public_notes',       count(*) FROM public_notes        -- 6 (5 published)
-- UNION ALL SELECT 'tasks',              count(*) FROM tasks               -- 10
-- UNION ALL SELECT 'habits',             count(*) FROM habits              -- 4
-- UNION ALL SELECT 'money_transaction',  count(*) FROM money_transaction;  -- about 35
