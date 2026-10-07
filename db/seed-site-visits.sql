-- =============================================================================
-- DEV ONLY — fake visitor data
-- =============================================================================
--
-- A freshly migrated database has nothing in `site_visits`, so /admin/analytics
-- renders one row and every chart looks broken. This generates ~90 days of
-- plausible traffic so the page can actually be judged: a weekly rhythm, a
-- realistic source mix, a long tail of countries, and some bot traffic.
--
-- **Never run this against a database whose numbers you care about.** Everything
-- it writes is marked with the sentinel timezone below so it can all be removed
-- again, but the honest advice is to run it on a scratch project.
--
-- To remove exactly what this created:
--
--     DELETE FROM site_visits WHERE timezone = 'Seed/Fake';
--
-- Run db/schema.sql first.
-- =============================================================================

-- The enrichment trigger overwrites created_at with now(), which would pile
-- every generated row onto today and defeat the point. Disabled for the insert
-- and restored immediately after — the rate limiter would also refuse this
-- volume, so it goes too.
-- One transaction: if the insert fails, the triggers must not stay disabled —
-- that would switch off the rate limit and IP hashing on the real table.
BEGIN;

ALTER TABLE site_visits DISABLE TRIGGER enrich_site_visit;
ALTER TABLE site_visits DISABLE TRIGGER limit_site_visits;
ALTER TABLE site_visits DISABLE TRIGGER notify_site_visit;

INSERT INTO site_visits (
  visitor_hash, path, referrer_host, source, channel,
  country, region, city, network, timezone, language,
  browser, os, device, screen_width, is_bot, created_at
)
SELECT
  -- One hash per (visitor, day), so unique-visitor counts behave like the real
  -- thing: the same person on two days is two hashes, as the daily salt makes it.
  md5(visitor::text || day::text),
  (ARRAY['/', '/', '/', '/about', '/projects', '/blog', '/blog/view', '/contact', '/updates'])[1 + floor(random() * 9)::int],
  CASE bucket
    WHEN 0 THEN NULL
    WHEN 1 THEN 'google.com'
    WHEN 2 THEN 'linkedin.com'
    WHEN 3 THEN 'news.ycombinator.com'
    WHEN 4 THEN 't.co'
    ELSE 'someblog.dev'
  END,
  CASE bucket
    WHEN 0 THEN 'Direct'
    WHEN 1 THEN 'Search'
    WHEN 2 THEN 'LinkedIn'
    WHEN 3 THEN 'Hacker News'
    WHEN 4 THEN 'X'
    ELSE 'someblog.dev'
  END,
  CASE bucket
    WHEN 0 THEN 'direct'
    WHEN 1 THEN 'search'
    WHEN 2 THEN 'social'
    WHEN 3 THEN 'social'
    WHEN 4 THEN 'social'
    ELSE 'referral'
  END,
  country_code,
  NULL,
  CASE country_code
    WHEN 'IN' THEN 'Mumbai' WHEN 'US' THEN 'New York' WHEN 'GB' THEN 'London'
    WHEN 'DE' THEN 'Berlin' WHEN 'CA' THEN 'Toronto' ELSE NULL
  END,
  CASE WHEN random() < 0.7
    THEN (ARRAY['Jio', 'Airtel', 'Comcast Cable', 'Deutsche Telekom', 'BT', 'Cloudflare'])[1 + floor(random() * 6)::int]
    ELSE NULL
  END,
  'Seed/Fake',                       -- sentinel: how you delete this again
  'en-GB',
  (ARRAY['Chrome','Chrome','Chrome','Safari','Safari','Firefox','Edge','Samsung Internet'])[1 + floor(random() * 8)::int],
  (ARRAY['Windows','macOS','iOS','Android','Android','Linux'])[1 + floor(random() * 6)::int],
  (ARRAY['desktop','desktop','mobile','mobile','mobile','tablet'])[1 + floor(random() * 6)::int],
  (ARRAY[1920, 1440, 1280, 430, 390, 820])[1 + floor(random() * 6)::int],
  false,
  -- Spread across the day so the by-hour breakdown is not a single spike.
  (now() - (day || ' days')::interval)::date
    + (random() * interval '24 hours')
FROM
  generate_series(0, 89) AS day,
  LATERAL generate_series(
    1,
    -- Weekends lighter than weekdays, with a gentle upward trend, so the chart
    -- has a shape rather than noise.
    GREATEST(
      1,
      (
        (12 + (89 - day) / 8)
        * CASE WHEN extract(dow FROM now() - (day || ' days')::interval) IN (0, 6)
               THEN 0.55 ELSE 1.0 END
        * (0.7 + random() * 0.6)
      )::int
    )
  ) AS visitor,
  LATERAL (SELECT floor(random() * 6)::int AS bucket) AS b,
  LATERAL (SELECT (ARRAY['IN','IN','IN','US','US','GB','DE','CA','AU','SG','BR','NL'])[1 + floor(random() * 12)::int] AS country_code) AS c;

-- Bot traffic, so the "excluding bots" toggle has something to toggle.
INSERT INTO site_visits (visitor_hash, path, source, channel, timezone, browser, os, device, is_bot, created_at)
SELECT
  md5('bot' || day::text || n::text),
  '/', 'Direct', 'direct', 'Seed/Fake', 'Other', 'Other', 'desktop', true,
  (now() - (day || ' days')::interval)::date + (random() * interval '24 hours')
FROM generate_series(0, 89) AS day,
     LATERAL generate_series(1, 3 + floor(random() * 6)::int) AS n;

ALTER TABLE site_visits ENABLE TRIGGER enrich_site_visit;
ALTER TABLE site_visits ENABLE TRIGGER limit_site_visits;
ALTER TABLE site_visits ENABLE TRIGGER notify_site_visit;

COMMIT;

SELECT
  count(*) FILTER (WHERE NOT is_bot) AS seeded_views,
  count(DISTINCT visitor_hash) FILTER (WHERE NOT is_bot) AS seeded_visitors,
  count(*) FILTER (WHERE is_bot) AS seeded_bot_views,
  min(created_at)::date AS oldest,
  max(created_at)::date AS newest
FROM site_visits WHERE timezone = 'Seed/Fake';
