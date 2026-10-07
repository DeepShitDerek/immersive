# FolioKit

A portfolio site you fill in from one config file, with an optional private workspace behind it. It builds to static files, so it runs on GitHub Pages or any static host. There is no server to run.

## Two ways to run it

|                    | Static site                      | With the workspace        |
| ------------------ | -------------------------------- | ------------------------- |
| Content comes from | `portfolio.config.ts`         | Your own Supabase project |
| You edit it by     | Changing the file and rebuilding | Signing in at `/admin`    |
| Needs              | Nothing                          | A free Supabase project   |
| Set up in          | A few minutes                    | About fifteen minutes     |

You can start static and add the workspace later. Nothing is thrown away.

## What is in it

**The public site:** home, work and case studies, about, blog, short updates, a contact form, and any extra pages you add.

**Four site styles.** Classic uses the theme and typography you pick. Noir, Paper and Dusk each bring their own colours, type and scroll-led layouts, and apply to the whole site and the workspace. Choose one in Settings → Site style.

**The workspace** (only with a database, behind a password and a second factor):

- _The site:_ Pages, Blog, Updates, Navigation, Assets, Inbox, Settings
- _Your work:_ Tasks, Notes, Calendar, Habits, Learning, Library, Whiteboard, Maps
- _Your records:_ Money, Inventory, Discover
- _Overview:_ Dashboard, Analytics, Security (backup, restore, lockdown)

## Quick start: a static site

You need Node 24 and npm.

```bash
git clone <your fork's address>
cd <the folder>
npm install
npm run dev
```

Open http://localhost:3000. Then:

1. Put your name, work and links in `portfolio.config.ts`.
2. Run `npm run build`. The site is written to `out/`.
3. Publish `out/` on any static host, or use the included workflow (see [Deploying](#deploying)).

## Adding the workspace

1. Create a project at [supabase.com](https://supabase.com).
2. In its SQL editor, paste all of [`db/schema.sql`](db/schema.sql) and run it. It creates the tables, the security policies, the `assets` storage bucket and placeholder content. It is safe to run again, and running it again is how you take a schema update.
3. Copy `.env.example` to `.env.local` and fill in the project's URL and anon key (Supabase → Project Settings → API).
4. Run `npm run dev`, open `/admin`, and create your account. **The first account is the owner; sign-up closes after it.** You are asked to enrol a second factor, and the workspace does not open without it.

To see the site filled in before writing your own content, run [`db/john-doe.sample.sql`](db/john-doe.sample.sql) in the SQL editor. It is John Doe, a made-up engineer, and the same person as `portfolio.config.ts`. Create your account first, then run it. Read its header: it replaces the public content already there, and adds sample tasks, notes, money and the rest to the workspace without touching what is yours.

## Deploying

`.github/workflows/next-deploy.yml` builds, checks and publishes to GitHub Pages on every push to `main`. Pull requests run the same build and checks and are never published.

One-time setup in your fork:

1. Settings → Pages → Source: **GitHub Actions**.
2. For a workspace site, Settings → Secrets and variables → Actions, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BUCKET_NAME` and `NEXT_PUBLIC_SITE_URL`. Without them the workflow publishes the static site.

Use a custom domain or a user site (`<you>.github.io`). A project site (`<you>.github.io/<repo>`) works for previewing, but some links assume the site is at the root.

`.github/workflows/keep-supabase-active.yml` pings the database once a day, because Supabase pauses free projects that go unused. It does nothing on a static site.

## Commands

| Command                             | What it does                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | Development server                                                                                                                       |
| `npm run build`                     | Production build into `out/`                                                                                                             |
| `npm test`                          | Unit tests                                                                                                                               |
| `npm run lint`, `npm run typecheck` | Lint and type checks                                                                                                                     |
| `npm run test:db`                   | Runs `schema.sql` twice against a throwaway Postgres and tests the security policies. Needs Docker                                       |
| `npm run check:*`                   | Checks on a finished build: accessibility, prerendered HTML, hydration, bundle size, theme contrast, and more. `package.json` lists them |

## Where things are

```
portfolio.config.ts   your content, for a static site
db/schema.sql         the whole database, in one re-runnable file
src/app/              routes: (public) is the site, admin is the workspace
src/features/         one folder per screen or module
src/components/ui/    shared interface components
src/lib/              helpers with no interface
src/store/            data fetching (RTK Query)
scripts/              the build checks
supabase/functions/   the optional "Publish site" function
.github/workflows/      build, check and deploy
```

## Things that may surprise you

- **A static build bakes in the content it was built with.** With a database, the page then refreshes from it in the browser, so an edit shows without a rebuild. Link-preview cards and a new post's own page need a rebuild: push, or use the Publish site button once you have set it up (`.ai/DEPLOYMENT.md`).
- **Development differs from production in four places, on purpose.** Fonts are linked from a `<link>` tag in development because the dev server drops the stylesheet import. Visits are not recorded in development unless `NEXT_PUBLIC_ANALYTICS_DEBUG=1`. Empty sections show a hint in development and nothing in production. The pages under `/dev/` exist only in builds made with `NEXT_PUBLIC_DEV_HARNESS=1`, which the browser checks use; every other build answers 404.
- **Everything in `NEXT_PUBLIC_*` is public.** The anon key is meant to be. What protects your data is the row-level security in `schema.sql`, which `npm run test:db` tests.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

See [`LICENSE`](LICENSE).
