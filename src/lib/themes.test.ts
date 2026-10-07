import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import config from "../../portfolio.config";
import { contrastRatio, hexToHsl, parseHslToken } from "./color-utils";
import { THEME_PRESETS } from "./constants";
import {
  DARK_THEME,
  DEFAULT_THEME,
  LIGHT_THEME,
  applySiteTheme,
  customThemeVars,
  pairedTheme,
  statusVars,
} from "./themes";

const ratio = (a: string, b: string) =>
  contrastRatio(parseHslToken(a)!, parseHslToken(b)!);

describe("one default theme", () => {
  it("is a real preset, and the config and the database seed start there", () => {
    expect(THEME_PRESETS.map((p) => p.value)).toContain(DEFAULT_THEME);
    expect(config.defaultTheme).toBe(DEFAULT_THEME);
    const schema = readFileSync(
      resolve(__dirname, "../../db/schema.sql"),
      "utf8",
    );
    expect(schema).toContain(`"default_theme": "${DEFAULT_THEME}"`);
  });

  it("is the light half of the core pair", () => {
    expect(DEFAULT_THEME).toBe(LIGHT_THEME);
    expect(THEME_PRESETS.map((p) => p.value)).toContain(DARK_THEME);
  });
});

describe("pairedTheme", () => {
  it("swaps a paired preset for its partner", () => {
    expect(pairedTheme("theme-solarized-light", "dark")).toBe(
      "theme-solarized-dark",
    );
    expect(pairedTheme("theme-hc-dark", "light")).toBe("theme-hc-light");
    expect(pairedTheme("theme-catppuccin-mocha", "light")).toBe(
      "theme-catppuccin-latte",
    );
  });

  it("falls back to the core pair for a preset with no partner", () => {
    expect(pairedTheme("theme-dracula", "light")).toBe(LIGHT_THEME);
    expect(pairedTheme("theme-custom", "dark")).toBe(DARK_THEME);
  });

  it("names only real presets", () => {
    const valid = new Set<string>(THEME_PRESETS.map((p) => p.value));
    for (const theme of valid) {
      expect(valid.has(pairedTheme(theme, "light"))).toBe(true);
      expect(valid.has(pairedTheme(theme, "dark"))).toBe(true);
    }
  });
});

describe("custom theme status colours", () => {
  // Grounds a custom theme might use, from paper to near-black.
  const light = ["#ffffff", "#f8f6f1", "#f4ead7", "#eef2f7"];
  const dark = ["#0d1117", "#0f172a", "#1d1c1a", "#2b2b2b"];
  const tokens = ["--destructive", "--success", "--warning", "--info"];

  it.each(light)("reads at 4.5:1 on a light ground %s", (ground) => {
    const vars = statusVars(false);
    for (const token of tokens) {
      expect(ratio(vars[token], hexToHsl(ground))).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(vars[`${token}-foreground`], vars[token]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(dark)("reads at 4.5:1 on a dark ground %s", (ground) => {
    const vars = statusVars(true);
    for (const token of tokens) {
      expect(ratio(vars[token], hexToHsl(ground))).toBeGreaterThanOrEqual(4.5);
      expect(
        ratio(vars[`${token}-foreground`], vars[token]),
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("follows the custom ground's scheme, not a fixed red", () => {
    const base = {
      foreground: "#111111",
      primary: "#2f3ab2",
      secondary: "#eeeeee",
      accent: "#dddddd",
      card: "#ffffff",
    };
    expect(
      customThemeVars({ ...base, background: "#ffffff" })["--destructive"],
    ).toBe(hexToHsl("#c62828"));
    expect(
      customThemeVars({ ...base, background: "#0d1117" })["--destructive"],
    ).toBe(hexToHsl("#f87171"));
  });
});

describe("applySiteTheme with a visitor's scheme", () => {
  afterEach(() => {
    document.documentElement.className = "";
  });

  // jsdom computes no CSS, so `dark` follows only what applyTheme reads; the
  // owner's theme is "light" here, and a dark request must swap it.
  it("keeps the owner's theme when the scheme already matches", () => {
    expect(
      applySiteTheme("theme-github-light", "typo-default", undefined, "light"),
    ).toBe("theme-github-light");
    expect(
      applySiteTheme("theme-github-light", "typo-default", undefined, null),
    ).toBe("theme-github-light");
  });

  it("swaps to the partner in the other scheme", () => {
    expect(
      applySiteTheme("theme-github-light", "typo-default", undefined, "dark"),
    ).toBe("theme-github-dark");
    expect(
      document.documentElement.classList.contains("theme-github-dark"),
    ).toBe(true);
  });
});
