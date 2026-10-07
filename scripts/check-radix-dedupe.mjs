import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Every Radix package the app uses must share one copy of Radix's layering
 * internals.
 *
 * Focus traps and dismissable layers keep module-level stacks. A Popover or
 * Select running a different copy from the Dialog around it is invisible to
 * that Dialog, which then pulls focus straight back out: the category picker
 * inside a sheet could not be typed into, and keyboard selection in Selects
 * failed, until the copies were deduplicated. It happened silently, because
 * the app's Popover had resolved to the version Excalidraw pins.
 *
 * Packages nested under another package (Excalidraw's own pinned copies) are
 * that package's business and are not checked. Runs after `npm ci`.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modules = path.join(root, "node_modules");
const SHARED = [
  "react-focus-scope",
  "react-dismissable-layer",
  "react-portal",
  "react-presence",
];

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const appRadix = Object.keys({
  ...pkg.dependencies,
  ...pkg.devDependencies,
}).filter((n) => n.startsWith("@radix-ui/"));

/** The version of `name` that code in `fromDir` resolves to, Node-style. */
function resolveVersion(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(
      dir,
      "node_modules",
      ...name.split("/"),
      "package.json",
    );
    if (existsSync(candidate))
      return {
        version: JSON.parse(readFileSync(candidate, "utf8")).version,
        where: path.relative(root, path.dirname(candidate)),
      };
    const parent = path.dirname(dir);
    if (parent === dir || !dir.startsWith(root)) return null;
    dir = parent;
  }
}

if (!existsSync(modules)) {
  console.error("No node_modules; run npm ci first.");
  process.exit(1);
}

let failed = 0;
for (const shared of SHARED) {
  const name = `@radix-ui/${shared}`;
  const seen = new Map();
  for (const dep of appRadix) {
    const depDir = path.join(modules, ...dep.split("/"));
    if (!existsSync(depDir)) continue;
    const found = resolveVersion(name, depDir);
    if (!found) continue; // this package does not use it
    const key = `${found.version} (${found.where})`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(dep);
  }
  if (seen.size > 1) {
    failed += 1;
    console.error(
      `✗ ${name}: ${seen.size} copies used by the app's Radix packages`,
    );
    for (const [copy, users] of seen)
      console.error(`    ${copy}: ${users.join(", ")}`);
  } else {
    console.log(
      `✓ ${name}: one copy${seen.size ? ` (${[...seen.keys()][0]})` : ""}`,
    );
  }
}

// Stray nested copies of app packages that Radix layering depends on.
const nestedOf = (dir) => {
  const nested = path.join(dir, "node_modules", "@radix-ui");
  return existsSync(nested)
    ? readdirSync(nested).filter((n) => SHARED.includes(n))
    : [];
};
for (const dep of appRadix) {
  const bad = nestedOf(path.join(modules, ...dep.split("/")));
  if (bad.length) {
    failed += 1;
    console.error(`✗ ${dep} carries its own ${bad.join(", ")}`);
  }
}

if (failed) {
  console.error(
    "\nUpdate the app's @radix-ui packages together (npm update @radix-ui/…), then npm dedupe.",
  );
  process.exit(1);
}
console.log(
  "\nThe app's Radix packages share one copy of each layering internal.",
);
