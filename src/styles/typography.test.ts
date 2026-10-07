import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TYPOGRAPHY_PRESETS } from "@/lib/constants";
import { GOOGLE_FONTS_URL } from "@/lib/google-fonts";

const read = (file: string) => readFileSync(resolve(__dirname, file), "utf8");
const typography = read("typography.css");
const themes = read("themes.css");
const globals = read("globals.css");
const layout = readFileSync(resolve(__dirname, "../app/layout.tsx"), "utf8");

/** Families the one Google Fonts request loads. */
const loaded = new Set(
  [...GOOGLE_FONTS_URL.matchAll(/family=([^:&]+)/g)].map((m) =>
    decodeURIComponent(m[1].replace(/\+/g, " ")),
  ),
);

describe("typography presets", () => {
  it("are defined in typography.css only", () => {
    // themes.css once carried a second, older copy of the presets. Whichever
    // file the build put last won, so the preset chosen in Settings could
    // render another pairing, or "Outfit", which is never loaded.
    expect(themes).not.toMatch(/\.typo-[a-z-]+\s*[,{]/);
    expect(themes).not.toMatch(/--font-(heading|body|code)\s*:/);
  });

  it("name only families the font import loads", () => {
    const named = [...typography.matchAll(/--font-[a-z]+:\s*"([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(named.filter((family) => !loaded.has(family))).toEqual([]);
  });

  it("exist in the CSS for every preset Settings offers", () => {
    const defined = new Set(
      [...typography.matchAll(/\.(typo-[a-z-]+)\s*[,{]/g)].map((m) => m[1]),
    );
    expect(
      TYPOGRAPHY_PRESETS.map((p) => p.value).filter((v) => !defined.has(v)),
    ).toEqual([]);
  });

  it("load by the CSS @import in production and a <link> in development, from one URL", () => {
    // The @import must be the first rule, or browsers ignore it.
    const imported = /^@import url\("([^"]+)"\);/.exec(
      globals.trimStart(),
    )?.[1];
    expect(imported).toBe(GOOGLE_FONTS_URL);
    // The dev server drops that import, so development links the same URL.
    expect(layout).toMatch(
      /process\.env\.NODE_ENV === "development" && \(\s*<link rel="stylesheet" href=\{GOOGLE_FONTS_URL\} \/>/,
    );
  });
});
