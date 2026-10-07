import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
import { TRACKING_URL_PATTERNS } from "./lib/no-tracking.mjs";
import { stripBasePath } from "./lib/base-path.mjs";

/**
 * Lighthouse on the public pages, against lighthouse-budget.json.
 *
 * The static export is served here gzipped, as GitHub Pages serves it;
 * uncompressed, FCP and LCP roughly double (PERFORMANCE.md). Mobile profile,
 * simulated throttling, three runs per page, median by score, the same method
 * as the first baselines.
 *
 * A ratchet like check:budget: a page fails when its median is worse than its
 * budget. Budgets are the baselines plus the measured noise (score ±4, LCP
 * ±0.2 s, TBT ±250 ms), so noise alone does not fail a build. Tighten a budget
 * in the commit that earns it.
 *
 * OUT overrides the export directory, CHROME_PATH the browser, RUNS the runs
 * per page, ONLY=<key> one page. REPORT=<file> writes the medians as JSON.
 *
 * Each line shows Lighthouse's benchmarkIndex, its measure of how fast this
 * machine's CPU was during the runs. Simulated throttling multiplies observed
 * CPU time, so a loaded or slower host scores worse: compare numbers only
 * between runs with similar benchmarks, and set CI budgets from CI runs.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? path.join(root, "out");
const RUNS = Number(process.env.RUNS ?? 3);
const budget = JSON.parse(
  readFileSync(path.join(root, "lighthouse-budget.json"), "utf8"),
);

if (!existsSync(path.join(OUT, "index.html"))) {
  console.error(`No build at ${OUT}; run npm run build first.`);
  process.exit(1);
}

// ── A gzip static server, like Pages ────────────────────────────────────────
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};
const COMPRESS = new Set([".html", ".js", ".css", ".json", ".txt", ".svg"]);
const gz = new Map();
const server = createServer((req, res) => {
  let file = path.join(
    OUT,
    decodeURIComponent(stripBasePath(new URL(req.url, "http://x").pathname)),
  );
  if (existsSync(file) && statSync(file).isDirectory())
    file = path.join(file, "index.html");
  let status = 200;
  if (!existsSync(file)) {
    status = 404;
    file = path.join(OUT, "404.html");
  }
  const ext = path.extname(file);
  let body = readFileSync(file);
  const headers = {
    "Content-Type": TYPES[ext] ?? "application/octet-stream",
    "Cache-Control": "public, max-age=600",
  };
  if (COMPRESS.has(ext) && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
    if (!gz.has(file)) gz.set(file, gzipSync(body, { level: 6 }));
    body = gz.get(file);
    headers["Content-Encoding"] = "gzip";
    headers.Vary = "Accept-Encoding";
  }
  headers["Content-Length"] = body.length;
  res.writeHead(status, headers);
  res.end(body);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// ── Chrome ──────────────────────────────────────────────────────────────────
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));
if (!CHROME) {
  console.error("Chrome not found; set CHROME_PATH.");
  process.exit(1);
}
/**
 * One Lighthouse run in a fresh Chrome, launched exactly as the CLI launches
 * it (chrome-launcher's flags: no background throttling, extensions or
 * component updates). Reusing one Chrome kept DNS and connections to Google
 * Fonts and GitHub warm (FCP ~1.5 s better than a visitor sees); launching it
 * with bare flags made the blog post's LCP ~1 s worse and CLS 0.06 instead of
 * 0.02. Either way the numbers stopped matching the CLI baselines.
 */
async function audit(url) {
  const chrome = await launch({
    chromePath: CHROME,
    chromeFlags: ["--headless=new"],
  });
  try {
    return await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["performance"],
      // Never a visit or a view on the live figures.
      blockedUrlPatterns: TRACKING_URL_PATTERNS,
    });
  } finally {
    // On Windows the temp profile can still be locked as Chrome exits
    // (EPERM); a leftover temp folder is not a failed check.
    try {
      await chrome.kill();
    } catch {
      // Left behind: a temp folder, nothing else.
    }
  }
}

// ── Pages: the budget's, plus one prerendered post ──────────────────────────
function firstPost() {
  const dir = path.join(OUT, "blog");
  if (!existsSync(dir)) return null;
  const slug = readdirSync(dir).find(
    (name) => name !== "view" && existsSync(path.join(dir, name, "index.html")),
  );
  return slug ? `/blog/${slug}/` : null;
}
const pages = Object.keys(budget.pages)
  .filter((key) => !process.env.ONLY || key === process.env.ONLY)
  .map((key) => [key, key === "post" ? firstPost() : key]);

const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = {};
let failed = 0;

try {
  for (const [key, route] of pages) {
    if (!route) {
      console.log(`- ${key}: no page in this build, skipped`);
      continue;
    }
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const result = await audit(`${base}${route}`);
      const audits = result.lhr.audits;
      runs.push({
        score: Math.round(result.lhr.categories.performance.score * 100),
        fcp: audits["first-contentful-paint"].numericValue / 1000,
        lcp: audits["largest-contentful-paint"].numericValue / 1000,
        tbt: audits["total-blocking-time"].numericValue,
        cls: audits["cumulative-layout-shift"].numericValue,
        bench: Math.round(result.lhr.environment.benchmarkIndex),
      });
    }
    // The run with the median score, reported whole so its numbers agree.
    const mid = median(runs.map((r) => r.score));
    const m = runs.find((r) => r.score === mid);
    report[key] = { route, ...m };

    const limit = budget.pages[key];
    const problems = [];
    if (m.score < limit.minScore)
      problems.push(`score ${m.score} < ${limit.minScore}`);
    if (m.lcp > limit.maxLcp)
      problems.push(`LCP ${m.lcp.toFixed(1)} s > ${limit.maxLcp} s`);
    if (m.tbt > limit.maxTbt)
      problems.push(`TBT ${Math.round(m.tbt)} ms > ${limit.maxTbt} ms`);
    if (m.cls > limit.maxCls)
      problems.push(`CLS ${m.cls.toFixed(2)} > ${limit.maxCls}`);
    const line = `${key} (${route}): score ${m.score}, FCP ${m.fcp.toFixed(1)} s, LCP ${m.lcp.toFixed(1)} s, TBT ${Math.round(m.tbt)} ms, CLS ${m.cls.toFixed(2)} (benchmark ${m.bench})`;
    if (problems.length) {
      failed += 1;
      console.error(`✗ ${line} — ${problems.join("; ")}`);
    } else {
      console.log(`✓ ${line}`);
    }
  }
} finally {
  server.close();
}

if (process.env.REPORT)
  writeFileSync(process.env.REPORT, JSON.stringify(report, null, 2));
if (failed > 0) {
  console.error(
    `\n${failed} page(s) over their Lighthouse budget (lighthouse-budget.json).`,
  );
  process.exit(1);
}
console.log("\nEvery page within its Lighthouse budget.");
