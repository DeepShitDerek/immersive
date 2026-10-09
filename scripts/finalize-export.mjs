import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasCredit, takesCredit, withCredit } from "./lib/export-html.mjs";

/**
 * Finishes the exported pages: the last step of a build.
 *
 * Each public page gets its closing footer line (lib/export-html.mjs), and
 * the build fails if a page ends up without one.
 *
 * Runs as `postbuild`, so `npm run build` always includes it. Calling
 * `next build` directly skips it.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? path.join(root, "out");

if (!existsSync(OUT)) {
  console.error(`No build at ${OUT}.`);
  process.exit(1);
}

async function pages(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await pages(full)));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

let added = 0;
const missing = [];
for (const file of await pages(OUT)) {
  const relative = path.relative(OUT, file);
  if (!takesCredit(relative)) continue;
  const html = await readFile(file, "utf8");
  const credited = withCredit(html);
  if (credited !== html) {
    await writeFile(file, credited);
    added += 1;
  }
  if (!hasCredit(credited)) missing.push(relative);
}

if (missing.length > 0) {
  console.error(
    `Export not finalized. Pages without a footer line:\n  ${missing.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(
  `Export finalized: ${added} page${added === 1 ? "" : "s"} written.`,
);
