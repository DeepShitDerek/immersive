import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Contrast of every theme preset's token pairs, from
 * src/styles/themes.css. Text pairs need 4.5:1, UI pairs 3:1 (WCAG 1.4.11).
 *   node scripts/theme-contrast.mjs          → report, exit 1 on a failure
 * Run after editing a preset. The pairs are the ones the app draws text
 * with; see ACCESSIBILITY.md.
 *
 * A token a preset does not resolve is a failure, not a skip (F6): a
 * missing `--success` would fall back to another preset's value and be
 * drawn on a ground nobody checked it against.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Comments out, so a rule's selector text is only its selectors.
const css = readFileSync(
  path.join(root, "src/styles/themes.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const hslToRgb = (h, s, l) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
};
const luminance = ([r, g, b]) => {
  const c = [r, g, b].map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const parse = (value) => {
  const m = /(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(value);
  return m ? hslToRgb(Number(m[1]), Number(m[2]), Number(m[3])) : null;
};
export const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Text pairs (4.5:1): [foreground token, background token].
const TEXT = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary-foreground", "primary"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive-foreground", "destructive"],
  ["primary", "background"],
  ["foreground", "secondary"],
  ["muted-foreground", "secondary"],
  ["destructive", "secondary"],
  ["secondary-foreground", "secondary"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "popover"],
  // Status is text too: a "Saved" or "Overdue" label in the status colour.
  ["success", "background"],
  ["success", "card"],
  ["warning", "background"],
  ["warning", "card"],
  ["info", "background"],
  ["info", "card"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
  ["info-foreground", "info"],
];

// UI pairs (3:1): the edge of a field or toggle against what it sits on.
const UI = [
  ["input", "background"],
  ["input", "card"],
  ["ring", "background"],
];

const REQUIRED = [...new Set([...TEXT, ...UI].flat())];

/**
 * Every rule whose selector list names a preset, so a grouped rule
 * (`.theme-a, .theme-b { … }`, the status defaults) counts for each one.
 * Later rules win, as in the cascade.
 */
const themes = new Map();
for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selectors = rule[1].split(",").map((s) => s.trim());
  const presets = selectors
    .map((s) => /^\.(theme-[a-z0-9-]+)$/.exec(s)?.[1])
    .filter(Boolean);
  // Only rules made of preset selectors (and the `:root` default alongside Ink).
  if (
    presets.length === 0 ||
    presets.length !== selectors.filter((s) => s !== ":root").length
  )
    continue;
  const vars = {};
  for (const v of rule[2].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g))
    vars[v[1]] = v[2];
  for (const name of presets)
    themes.set(name, { ...(themes.get(name) ?? {}), ...vars });
}

let failures = 0;
for (const [name, vars] of themes) {
  const bad = [];
  const missing = REQUIRED.filter((token) => !parse(vars[token] ?? ""));
  if (missing.length) bad.push(`missing ${missing.join(", ")}`);
  for (const [pairs, min] of [
    [TEXT, 4.5],
    [UI, 3],
  ]) {
    for (const [fg, bg] of pairs) {
      const a = parse(vars[fg] ?? "");
      const b = parse(vars[bg] ?? "");
      if (!a || !b) continue;
      const r = ratio(a, b);
      if (r < min) bad.push(`${fg} on ${bg} ${r.toFixed(2)} (needs ${min})`);
    }
  }
  if (bad.length) {
    failures += bad.length;
    console.log(`✗ ${name}: ${bad.join("; ")}`);
  }
}
console.log(
  `\n${themes.size} presets, ${failures} failing check${failures === 1 ? "" : "s"}`,
);
process.exit(failures ? 1 : 0);
