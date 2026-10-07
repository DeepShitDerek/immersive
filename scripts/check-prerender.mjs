import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Post-build guard: the public pages' static HTML must
 * contain their content, not just a shell that JavaScript fills in later.
 *
 * Checks every prerendered public page for a non-empty <h1>, and every
 * prerendered post for its own <title> and og:title, and every shared page for
 * a built og:image. Run after `next build`.
 * Fails loudly if a change reintroduces client-only rendering — for example a
 * useSearchParams() that opts a whole page out of prerendering.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");

const PAGES = ["", "about", "contact", "blog", "work", "updates"];
/** Removed pages that must not come back (2026-10-01: /work only). */
const GONE = ["projects", "showcase"];
const failures = [];

const read = (relative) => readFileSync(path.join(out, relative), "utf8");
const text = (html) => html.replace(/<[^>]+>/g, "").trim();

function h1Of(html) {
  const match = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  return match ? text(match[1]) : "";
}

if (!existsSync(out)) {
  console.error("✗ out/ not found — run `next build` first");
  process.exit(1);
}

for (const page of PAGES) {
  const file = path.join(page, "index.html");
  if (!existsSync(path.join(out, file))) {
    failures.push(`${file}: missing`);
    continue;
  }
  const h1 = h1Of(read(file));
  if (!h1) failures.push(`${file}: no <h1> text in the static HTML`);
  else console.log(`✓ /${page} — h1 "${h1.slice(0, 60)}"`);
}

for (const page of GONE) {
  if (existsSync(path.join(out, page, "index.html")))
    failures.push(`${page}/index.html: removed page is back`);
  else console.log(`✓ /${page} is gone (its sections live on /work)`);
}

const blogDir = path.join(out, "blog");
const posts = existsSync(blogDir)
  ? readdirSync(blogDir, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          !["view", "_"].includes(d.name) &&
          !d.name.startsWith("__next"),
      )
      .map((d) => d.name)
  : [];

for (const slug of posts) {
  const file = path.join("blog", slug, "index.html");
  const html = read(file);
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? "";
  if (!h1Of(html)) failures.push(`${file}: no <h1> text`);
  if (!title || /^Post\b/.test(title)) {
    failures.push(`${file}: generic <title> "${title}"`);
  }
  if (!/property="og:title"/.test(html)) failures.push(`${file}: no og:title`);
  if (!failures.some((f) => f.startsWith(file))) {
    console.log(`✓ /blog/${slug}/ — "${title.slice(0, 60)}"`);
  }
}

/*
  Link previews: every page names an og:image, and one on this site
  must be a built 1200×630 PNG — a preview pointing at a missing file shows
  as a blank card in every feed it is shared to.
*/
const workDir = path.join(out, "work");
const studies = existsSync(workDir)
  ? readdirSync(workDir, { withFileTypes: true })
      .filter(
        (d) =>
          d.isDirectory() &&
          !["view", "_"].includes(d.name) &&
          !d.name.startsWith("__next"),
      )
      .map((d) => path.join("work", d.name))
  : [];
const shared = [
  ...PAGES,
  ...posts.map((slug) => path.join("blog", slug)),
  ...studies,
];
for (const page of shared) {
  const file = path.join(page, "index.html");
  if (!existsSync(path.join(out, file))) continue;
  const image = /<meta property="og:image" content="([^"]+)"/.exec(
    read(file),
  )?.[1];
  if (!image) {
    failures.push(`${file}: no og:image`);
    continue;
  }
  const local = /\/og\/.+\.png$/.exec(
    new URL(image, "https://x").pathname,
  )?.[0];
  if (!local) continue; // an owner-chosen cover hosted elsewhere
  const png = path.join(out, local);
  if (!existsSync(png)) {
    failures.push(`${file}: og:image ${local} was not built`);
    continue;
  }
  // PNG IHDR: width and height are big-endian at bytes 16 and 20.
  const header = readFileSync(png).subarray(0, 24);
  const size = `${header.readUInt32BE(16)}×${header.readUInt32BE(20)}`;
  if (size !== "1200×630")
    failures.push(`${local}: ${size}, expected 1200×630`);
}
console.log(`✓ ${shared.length} link previews checked`);

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} prerender problem(s):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `\n${PAGES.length} pages and ${posts.length} posts prerendered with content`,
);
