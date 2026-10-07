# Contributing

Thanks for looking. Fixes, new section layouts, themes and documentation are all welcome.

## Getting set up

```bash
npm install
npm run dev
```

With no `.env.local` the site runs static, from `portfolio.config.ts`. That is enough for most work on the public site. To work on the workspace, follow "Adding the workspace" in the [README](README.md) with a Supabase project of your own. Do not develop against a database that holds real data.

## Before you open a pull request

Run these:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

If you changed `db/schema.sql`, also run `npm run test:db` (needs Docker). CI runs all of these, plus accessibility and browser checks, on every pull request. A pull request is never deployed.

## Conventions

- **Commits** follow [Conventional Commits](https://www.conventionalcommits.org): `fix(blog): …`, `feat(immersive): …`.
- **Files** are kebab-case (`command-palette.tsx`); components are PascalCase named exports.
- **One folder per screen** in `src/features/`. Logic with no interface goes in a plain `.ts` file next to it, with a test.
- **Tests come with the change.** A bug fix starts with a test that fails without it.
- **Comments say why,** not what. If the code is there because of something that went wrong once, say what went wrong.
- **Text on screen is plain.** No invented claims on public pages: placeholder content says it is a placeholder.

## The database

`db/schema.sql` is the whole database and is applied by running it again. So every change to it must be safe to re-run: `CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, policies dropped then created. There is no migrations folder.

Every table has row-level security. A new table needs policies, and a test in `db/test/` showing what a visitor, a password-only session and the verified owner can each do with it.

## Security

Never commit a key, a token or a real `.env`. Everything named `NEXT_PUBLIC_*` ends up in the JavaScript visitors download, so nothing secret can use that prefix.

If you find a security problem, please report it privately to the maintainer rather than opening a public issue.

## Background reading

`.ai/` and `docs/` hold the design notes, decisions and audits behind the code. `.ai/ARCHITECTURE.md` is the place to start.
