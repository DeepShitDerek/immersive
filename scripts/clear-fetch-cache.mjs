import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every build reads the database afresh.
 *
 * While prerendering, Next.js stores each `fetch` response under
 * `.next/cache/fetch-cache` and reuses it for a year. For a site whose pages
 * are drawn from a database at build time, that makes a build a replay of
 * the first one: settings changed since (the site style, the theme, a new
 * post) never reach the HTML, the link-preview cards or the sitemap, however
 * many times the site is rebuilt. CI restores `.next/cache` between runs, so
 * a deploy replays it too.
 *
 * Removing the folder before the build keeps what the cache is good for
 * (within one build, every page sees the same snapshot, and each query runs
 * once) and drops the part that is wrong. The compiler's own cache, next to
 * it, is left alone.
 *
 * Runs as part of `prebuild`, so `npm run build` is always fresh. Calling
 * `next build` directly skips it.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".next", "cache", "fetch-cache");

if (existsSync(cache)) {
  await rm(cache, { recursive: true, force: true });
  console.log("Cleared .next/cache/fetch-cache: this build reads live data.");
}
