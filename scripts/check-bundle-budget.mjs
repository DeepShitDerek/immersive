import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { stripBasePath } from "./lib/base-path.mjs";

/**
 * JavaScript budget for the public pages.
 *
 * Sums the gzipped size of every script each exported public page loads —
 * the `<script src>` tags in its HTML under out/ — and fails when a route
 * exceeds its budget in bundle-budget.json. The budgets are a ratchet:
 * today's size plus a little headroom. A change that makes a page heavier
 * has to either win the bytes back or raise the budget in the same commit,
 * where a reviewer sees it.
 *
 * Measured from the HTML rather than a build manifest: the
 * manifests are Next's internals (app-build-manifest.json went away in 16),
 * while the scripts a page's HTML asks for are exactly what a visitor
 * downloads before the page works. Lazily imported chunks are not counted.
 *
 * It exists because an import of three labels once pulled every admin form's
 * schema into every public page (+18 KB), and nothing but a human reading the
 * build output noticed.
 *
 *   node scripts/check-bundle-budget.mjs            check
 *   node scripts/check-bundle-budget.mjs --update   rewrite budgets (+3 KB)
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const budgetPath = path.join(root, "bundle-budget.json");
const HEADROOM_KB = 3;

/** The first real child page of a directory (not Next's `__next.*` segment data). */
function firstChild(dir) {
  const full = path.join(out, dir);
  if (!existsSync(full)) return null;
  const name = readdirSync(full, { withFileTypes: true }).find(
    (d) =>
      d.isDirectory() &&
      !d.name.startsWith("__next") &&
      existsSync(path.join(full, d.name, "index.html")),
  )?.name;
  return name ? path.join(dir, name, "index.html") : null;
}

const ROUTES = {
  "/": "index.html",
  "/about": "about/index.html",
  "/work": "work/index.html",
  "/blog": "blog/index.html",
  "/blog/[slug]": firstChild("blog"),
  "/work/[slug]": firstChild("work"),
  "/contact": "contact/index.html",
  "/updates": "updates/index.html",
};

if (!existsSync(out)) {
  console.error("✗ out/ not found — run `next build` first");
  process.exit(1);
}
const gzipCache = new Map();
const gzipKb = (src) => {
  if (!gzipCache.has(src)) {
    const file = path.join(out, decodeURIComponent(src.split("?")[0]));
    gzipCache.set(
      src,
      gzipSync(readFileSync(file), { level: 9 }).length / 1024,
    );
  }
  return gzipCache.get(src);
};

const sizes = {};
for (const [route, html] of Object.entries(ROUTES)) {
  if (!html || !existsSync(path.join(out, html))) {
    console.error(`✗ ${route}: no exported page (${html ?? "none found"})`);
    process.exit(1);
  }
  const markup = readFileSync(path.join(out, html), "utf8");
  const scripts = new Set(
    [...markup.matchAll(/<script[^>]*>/g)]
      .map((m) => m[0])
      // `noModule` polyfills are for browsers without ES modules; no
      // current browser downloads them.
      .filter((tag) => !/\bnomodule\b/i.test(tag))
      .map((tag) => /\ssrc="([^"]+\.js[^"]*)"/.exec(tag)?.[1])
      .filter((src) => src !== undefined)
      // Same-origin files only; the path is the file under out/.
      .filter((src) => src.startsWith("/"))
      // A project-site build prefixes every asset with its base path.
      .map((src) => stripBasePath(src)),
  );
  sizes[route] =
    Math.round([...scripts].reduce((sum, src) => sum + gzipKb(src), 0) * 10) /
    10;
}

if (process.argv.includes("--update")) {
  const budgets = Object.fromEntries(
    Object.entries(sizes).map(([route, kb]) => [
      route,
      Math.ceil(kb + HEADROOM_KB),
    ]),
  );
  writeFileSync(budgetPath, `${JSON.stringify(budgets, null, 2)}\n`);
  console.log("Budgets written to bundle-budget.json:");
  console.table(budgets);
  process.exit(0);
}

const budgets = JSON.parse(readFileSync(budgetPath, "utf8"));
let over = 0;
for (const [route, kb] of Object.entries(sizes)) {
  const budget = budgets[route];
  if (budget === undefined) {
    console.error(`✗ ${route}: ${kb} KB, no budget set (run with --update)`);
    over += 1;
  } else if (kb > budget) {
    console.error(`✗ ${route}: ${kb} KB gzipped, budget ${budget} KB`);
    over += 1;
  } else {
    console.log(`✓ ${route}: ${kb} KB gzipped (budget ${budget} KB)`);
  }
}
if (over > 0) {
  console.error(
    "\nA public page got heavier. Find the import that did it (often a shared" +
      " module pulling in admin code), or raise its budget in" +
      " bundle-budget.json in the same commit.",
  );
  process.exit(1);
}
