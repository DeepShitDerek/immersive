import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Excalidraw loads its fonts at runtime from `window.EXCALIDRAW_ASSET_PATH`,
 * falling back to a public CDN when a file is missing. This copies them into
 * `public/` so a static export serves its own assets instead of reaching out
 * to esm.sh on every board.
 *
 * Xiaolai is skipped on purpose: it is 13 MB of the 14 MB font payload and is
 * only needed for CJK glyphs, which fall back to the CDN if they are ever
 * typed. Everything else together is well under a megabyte.
 */
const SKIP = new Set(["Xiaolai"]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(
  root,
  "node_modules/@excalidraw/excalidraw/dist/prod/fonts",
);
const target = path.join(root, "public/excalidraw/fonts");

if (!existsSync(source)) {
  console.error(
    "[excalidraw] fonts not found — is @excalidraw/excalidraw installed?",
  );
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });

const families = await readdir(source, { withFileTypes: true });
let copied = 0;

for (const family of families) {
  if (SKIP.has(family.name)) continue;
  await cp(path.join(source, family.name), path.join(target, family.name), {
    recursive: true,
  });
  copied += 1;
}

console.log(`[excalidraw] copied ${copied} font families to public/excalidraw`);
