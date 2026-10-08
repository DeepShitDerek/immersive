# FolioKit

A portfolio site you fill in from one config file, with an optional private workspace behind it. It builds to static files, so it runs on GitHub Pages or any static host. There is no server to run.

- [Two ways to run it](#two-ways-to-run-it)
- [What is in it](#what-is-in-it)
- [Quick start: a static site](#quick-start-a-static-site)
- [Making it yours](#making-it-yours)
- [Dynamic mode setup](#dynamic-mode-setup)
- [Deploying](#deploying)
- [Commands](#commands)
- [Where things are](#where-things-are)
- [Things that may surprise you](#things-that-may-surprise-you)
- [Troubleshooting](#troubleshooting)

## Two ways to run it

|                    | Static site                      | Dynamic site (with the workspace) |
| ------------------ | -------------------------------- | --------------------------------- |
| Content comes from | `portfolio.config.ts`            | Your own Supabase project         |
| You edit it by     | Changing the file and rebuilding | Signing in at `/admin`            |
| Needs              | Nothing                          | A free Supabase project           |
| Set up in          | A few minutes                    | About fifteen minutes             |
| Contact form       | Optional Discord webhook         | Saved to your inbox               |
| Blog               | Posts written in the config file | Written in the editor at `/admin` |

The mode is decided by two environment variables. With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` empty, the site is static. With them set, it is dynamic. There is no other switch.

You can start static and add the database later. Nothing is thrown away: `portfolio.config.ts` stays as the fallback the site shows when the database cannot be reached.

## What is in it

**The public site:** home, work and case studies, about, blog, short updates, a contact form, and any extra pages you add.

**Four site styles.** Classic uses the theme and typography you pick. Noir, Paper and Dusk each bring their own colours, type and scroll-led layouts, and apply to the whole site and the workspace. Choose one in Settings → Site style.

**The workspace** (dynamic mode only, behind a password and a second factor):

- _The site:_ Pages, Blog, Updates, Navigation, Assets, Inbox, Settings
- _Your work:_ Tasks, Notes, Calendar, Habits, Learning, Library, Whiteboard, Maps
- _Your records:_ Money, Inventory, Discover
- _Overview:_ Dashboard, Analytics, Security (backup, restore, lockdown)

## Quick start: a static site

You need Node 24 and npm.

1. On GitHub, press **Use this template** (or fork the repository), then clone your copy:

   ```bash
   git clone https://github.com/<you>/<your-repo>.git
   cd <your-repo>
   npm install
   npm run dev
   ```

2. Open http://localhost:3000. You are looking at John Doe, the sample person the template ships with.
3. Replace him with you in `portfolio.config.ts` (see [Making it yours](#making-it-yours)). The dev server reloads as you save.
4. Run `npm run build`. The finished site is written to `out/`.
5. Publish `out/` on any static host, or push to `main` and let the included workflow do it (see [Deploying](#deploying)).

That is a complete site. Everything below is optional.

## Making it yours

`portfolio.config.ts` is one typed object. Your editor will tell you when a value has the wrong shape. Its parts, in the order they appear:

| Section               | What it controls                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| Identity              | `name`, `title`, `description`, the home page `headline`, `proof` figures, picture, `logo`, `bio` |
| Theme                 | `defaultTheme` and `typographyPreset` (the full lists are in `src/lib/constants.ts`)              |
| Status panel          | The "currently" card on the home page: availability, what you are building, what you are reading  |
| Social links, footer  | Links in the header, footer and contact page; the footer line                                     |
| GitHub                | Your username, to list public repositories on `/work`                                             |
| Contact               | Whether the contact page shows the form, the availability badge and your services                 |
| Navigation            | `navLinks` for the header, `footerLinks` for the footer                                           |
| Experience, education | The timeline on `/about`                                                                          |
| Tech stack, tools     | Skill groups on `/about`                                                                          |
| Showcase, projects    | The work shown on `/work` and featured on the home page                                           |
| Services, process     | Optional sections for freelancers. Delete them if you are not selling anything                    |
| Blog posts            | Static-mode posts, written in markdown                                                            |
| Life updates          | The short entries on `/updates`                                                                   |
| Product               | The `/kit` page that advertises this template. Set `show: false` on your own site                 |

A few things worth doing first:

1. **Change every identity value.** The sample numbers and employers are made up; leave none of them on a real site.
2. **Set `product.show` to `false`.** That removes `/kit` and the "Built with" line in the footer.
3. **Replace the picture.** `profilePicture` takes a URL or a file you put in `public/`.
4. **Set your site's address.** Copy `.env.example` to `.env.local` and fill in `NEXT_PUBLIC_SITE_URL` (for example `https://example.com`, no trailing slash). Link-preview cards and canonical addresses are built from it.
5. **Replace `public/favicon.ico`.**

To receive contact-form messages on a static site, set `NEXT_PUBLIC_CONTACT_WEBHOOK_URL` to a Discord webhook. Read the warning beside it in `.env.example` first: on a static site that address is public. In dynamic mode messages go to your inbox instead and the webhook stays private.

## Dynamic mode setup

Dynamic mode adds a database, so you edit the site from the browser and get the workspace.

1. Create a project at [supabase.com](https://supabase.com). The free tier is enough.
2. In its SQL editor, paste all of [`db/schema.sql`](db/schema.sql) and run it. It creates the tables, the security policies, the `assets` storage bucket and placeholder content. It is safe to run again, and running it again is how you take a schema update.
3. Copy `.env.example` to `.env.local` and fill in the project's URL and anon key (Supabase → Project Settings → API):

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   NEXT_PUBLIC_BUCKET_NAME=assets
   NEXT_PUBLIC_SITE_URL=https://example.com
   ```

4. Run `npm run dev`, open `/admin`, and create your account. **The first account is the owner; sign-up closes after it.** You are asked to enrol a second factor with an authenticator app, and the workspace does not open without it.
5. Fill in the site from the workspace: Settings for your name, theme and site style; Pages for sections; Blog for posts; Navigation for the menu.

To see the site filled in before writing your own content, run [`db/john-doe.sample.sql`](db/john-doe.sample.sql) in the SQL editor. It is John Doe, the same person as `portfolio.config.ts`. Create your account first, then run it. Read its header: it replaces the public content already there, and adds sample tasks, notes, money and the rest to the workspace without touching what is yours.

If `/admin` says there is no database or no schema, it is telling you which of steps 2 and 3 is missing. The values are read at build time, so restart `npm run dev` after changing `.env.local`.

### Updating the database later

When you pull a newer version of the template, run `db/schema.sql` again. Every statement in it is written to be re-run, and there is no migrations folder to keep in order. The deploy workflow checks the live database against the code before publishing and stops if the schema is behind.

## Deploying

### GitHub Pages (included)

`.github/workflows/next-deploy.yml` builds, checks and publishes to GitHub Pages on every push to `main`. Pull requests run the same build and checks and are never published.

One-time setup in your repository:

1. Settings → Pages → Source: **GitHub Actions**.
2. For a dynamic site, Settings → Secrets and variables → Actions, add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BUCKET_NAME` and `NEXT_PUBLIC_SITE_URL`. Without them the workflow publishes the static site.
3. Push to `main`.

Use a custom domain or a user site (`<you>.github.io`). A project site (`<you>.github.io/<repo>`) works for previewing, but some links assume the site is at the root.

`.github/workflows/keep-supabase-active.yml` pings the database once a day, because Supabase pauses free projects that go unused. It does nothing on a static site.

### Any other static host

Run `npm run build` and upload `out/`. Netlify, Cloudflare Pages, Vercel (as a static site) and an S3 bucket all work. Set the same `NEXT_PUBLIC_*` variables in the host's build settings, set the build command to `npm run build` and the output directory to `out`.

### The Publish site button (optional)

In dynamic mode an edit shows on the site straight away, but a new post's own page and its link-preview card only exist after a build. The **Publish site** button in Blog and Navigation starts that build for you. It needs a Supabase Edge Function, because starting a GitHub workflow takes a token and a token in the browser is a token anyone can read.

1. Create a fine-grained GitHub token with **Actions: read and write** on your repository only.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli), link your project, then:

   ```bash
   supabase secrets set GITHUB_REPO=<you>/<your-repo> GITHUB_TOKEN=<token> SITE_ORIGIN=https://example.com
   supabase functions deploy publish-site
   ```

   `GITHUB_WORKFLOW` (default `next-deploy.yml`) and `GITHUB_REF` (default `main`) can be set the same way if yours differ.

Until the function is deployed a short note is shown in the button's place, and pushing to `main` rebuilds the site just the same.

## Commands

| Command                             | What it does                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                       | Development server                                                                                                                       |
| `npm run build`                     | Production build into `out/`                                                                                                             |
| `npm test`                          | Unit tests                                                                                                                               |
| `npm run lint`, `npm run typecheck` | Lint and type checks                                                                                                                     |
| `npm run format`                    | Format everything with Prettier (`npm run format:check` only reports)                                                                    |
| `npm run test:db`                   | Runs `schema.sql` twice against a throwaway Postgres and tests the security policies. Needs Docker                                       |
| `npm run test:seed`                 | Loads the sample person into a throwaway Postgres. Needs Docker                                                                          |
| `npm run check:*`                   | Checks on a finished build: accessibility, prerendered HTML, hydration, bundle size, theme contrast, and more. `package.json` lists them |

## Where things are

```
portfolio.config.ts   your content, for a static site
db/schema.sql         the whole database, in one re-runnable file
db/john-doe.sample.sql  the sample person, for a dynamic site
src/app/              routes: (public) is the site, admin is the workspace
src/features/         one folder per screen or module
src/components/ui/    shared interface components
src/lib/              helpers with no interface
src/store/            data fetching (RTK Query)
src/styles/           design tokens, theme presets and typography
scripts/              the build checks
supabase/functions/   the optional "Publish site" function
.github/workflows/    build, check and deploy
```

To add a theme, add a preset to `src/styles/themes.css` and list it in `src/lib/constants.ts`; `npm run check:themes` tells you whether its text is readable. To add a section layout, add a component under `src/features/sections/` and register it in `section-layouts.ts`.

## Things that may surprise you

- **A static build bakes in the content it was built with.** With a database, the page then refreshes from it in the browser, so an edit shows without a rebuild. Link-preview cards and a new post's own page need a rebuild: push, or use the Publish site button once you have set it up.
- **Development differs from production in four places, on purpose.** Fonts are linked from a `<link>` tag in development because the dev server drops the stylesheet import. Visits are not recorded in development unless `NEXT_PUBLIC_ANALYTICS_DEBUG=1`. Empty sections show a hint in development and nothing in production. The pages under `/dev/` exist only in builds made with `NEXT_PUBLIC_DEV_HARNESS=1`, which the browser checks use; every other build answers 404.
- **Everything in `NEXT_PUBLIC_*` is public.** The anon key is meant to be. What protects your data is the row-level security in `schema.sql`, which `npm run test:db` tests.
- **There is one owner.** The workspace is for one person. The first account created is the owner and nobody else can sign up.

## Troubleshooting

| What you see                                     | What to check                                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `/admin` says there is no database               | `.env.local` is missing the two Supabase values, or the dev server was not restarted after you added them          |
| `/admin` says the schema is missing              | Run `db/schema.sql` in the Supabase SQL editor                                                                     |
| The site still shows John Doe in dynamic mode    | The database has the placeholder or sample content. Edit it in the workspace                                       |
| A new post opens at `/blog/view/?slug=…`         | Its own page is created by the next build. Push, or use Publish site                                               |
| Styles or links are broken on GitHub Pages       | You are on a project site (`<you>.github.io/<repo>`). Use a custom domain or a user site                           |
| The deploy stops at "Check live database schema" | The code expects a newer schema than the database has. Run `db/schema.sql` again                                   |
| The workspace stopped loading after a few weeks  | Supabase paused the free project. Restore it in the dashboard; the keep-alive workflow prevents it happening again |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT. See [`LICENSE`](LICENSE).
