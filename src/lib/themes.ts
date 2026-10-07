import { hexToHsl, isDarkBackground } from "./color-utils";
import { THEME_PRESETS, TYPOGRAPHY_PRESETS } from "./constants";
import type { SiteContent } from "@/types";

/**
 * Theme application logic. The labeled preset registry lives in
 * `constants.ts` (used by the settings UI); the class lists here are derived
 * from it so the two can never drift.
 */

/** "theme-custom" is applied via inline CSS vars, not a globals.css class. */
export const CUSTOM_THEME = "theme-custom";

export const VALID_THEMES = [
  ...THEME_PRESETS.map((t) => t.value),
  CUSTOM_THEME,
];

const TYPOGRAPHY_CLASSES = TYPOGRAPHY_PRESETS.map((t) => t.value);

/**
 * The one default: the code fallback, `portfolio.config.ts`, the
 * `db/schema.sql` seed and the settings form all start here, so a fresh
 * install, a static build and a missing value agree. `themes.test.ts` holds
 * the config and the seed to it.
 */
export const DEFAULT_THEME = "theme-field-notes-light";
export const THEME_STORAGE_KEY = "site-theme";

/**
 * The core pair (Field Notes). Anything offering a plain light/dark choice
 * must pick real preset classes — setting a bare `light`/`dark` class leaves
 * the app with no tokens at all — and a preset without a partner of the
 * other scheme falls back to these.
 */
export const LIGHT_THEME = "theme-field-notes-light";
export const DARK_THEME = "theme-field-notes-dark";

/** Presets that come as a light and a dark version of one palette. */
const THEME_PAIRS: readonly (readonly [light: string, dark: string])[] = [
  [LIGHT_THEME, DARK_THEME],
  ["theme-ink-light", "theme-ink-dark"],
  ["theme-github-light", "theme-github-dark"],
  ["theme-hc-light", "theme-hc-dark"],
  ["theme-aaa-light", "theme-aaa-dark"],
  ["theme-mono-light", "theme-mono-dark"],
  ["theme-catppuccin-latte", "theme-catppuccin-mocha"],
  ["theme-rose-pine-dawn", "theme-rose-pine"],
  ["theme-solarized-light", "theme-solarized-dark"],
  ["theme-gruvbox-light", "theme-gruvbox-dark"],
  ["theme-tokyo-night-day", "theme-tokyo-night"],
  ["theme-flexoki-light", "theme-flexoki-dark"],
  ["theme-glass-frost", "theme-glass-dark"],
  ["theme-neobrutalism-light", "theme-neobrutalism-dark"],
];

export type Scheme = "light" | "dark";

/**
 * The owner's theme in the scheme a visitor asked for: its own partner when
 * it has one (Solarized Light → Solarized Dark, the high-contrast pair stays
 * high-contrast), the core pair otherwise. The caller only asks when the
 * applied theme is the other scheme, so an unpaired theme is never swapped
 * for no reason.
 */
export function pairedTheme(themeClass: string, scheme: Scheme): string {
  for (const [light, dark] of THEME_PAIRS) {
    if (themeClass === light || themeClass === dark) {
      return scheme === "light" ? light : dark;
    }
  }
  return scheme === "light" ? LIGHT_THEME : DARK_THEME;
}

/**
 * A visitor's light/dark choice (the header toggle). Separate from
 * `site-theme`, which caches the *applied* class for the first paint: this
 * is the preference, and the owner's theme still decides everything else.
 */
const SCHEME_STORAGE_KEY = "visitor-scheme";

function readVisitorScheme(): Scheme | null {
  try {
    const value = window.localStorage.getItem(SCHEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

export function writeVisitorScheme(scheme: Scheme): void {
  try {
    window.localStorage.setItem(SCHEME_STORAGE_KEY, scheme);
  } catch {
    // Best-effort, like the theme cache: the switch still applies now.
  }
}

type CustomThemeColors = NonNullable<
  SiteContent["profile_data"]["custom_theme_colors"]
>;

/** CSS variables that themes control (as defined in globals.css). */
const THEME_CSS_VARS = [
  "background",
  "foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "muted",
  "muted-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "info",
  "info-foreground",
  "border",
  "input",
  "ring",
] as const;

/** Normalize a stored theme value ("dracula" or "theme-dracula") to a class. */
export function resolveThemeClass(dbTheme: string | undefined): string {
  if (!dbTheme) return DEFAULT_THEME;
  return dbTheme.startsWith("theme-") ? dbTheme : `theme-${dbTheme}`;
}

/**
 * Map the 6 user-picked colors onto the full CSS variable set.
 *
 * Returned as plain declarations rather than written to the DOM, so the same
 * mapping serves both callers: `applyCustomThemeColors` puts it on <html>, and
 * the settings preview puts it on a single subtree. A preview that derived the
 * variables itself would be a second mapping, and the one you were looking at
 * while choosing colours would be the one with no test behind it.
 */
export function customThemeVars(
  colors: CustomThemeColors,
): Record<string, string> {
  return {
    "--background": hexToHsl(colors.background),
    "--foreground": hexToHsl(colors.foreground),
    "--primary": hexToHsl(colors.primary),
    "--primary-foreground": hexToHsl(colors.background),
    "--secondary": hexToHsl(colors.secondary),
    "--secondary-foreground": hexToHsl(colors.foreground),
    "--accent": hexToHsl(colors.accent),
    "--accent-foreground": hexToHsl(colors.background),
    "--card": hexToHsl(colors.card),
    "--card-foreground": hexToHsl(colors.foreground),
    "--popover": hexToHsl(colors.background),
    "--popover-foreground": hexToHsl(colors.foreground),
    "--muted": hexToHsl(colors.secondary),
    "--muted-foreground": hexToHsl(colors.foreground),
    ...statusVars(isDarkBackground(hexToHsl(colors.background))),
    "--border": hexToHsl(colors.secondary),
    "--input": hexToHsl(colors.secondary),
    "--ring": hexToHsl(colors.primary),
  };
}

/**
 * Danger and status colours for a custom palette.
 *
 * The owner picks six colours, none of them a status, so these come from the
 * scheme the ground implies. The old fixed `#ef4444` measured 3.76:1 on white
 * and failed AA on every light custom theme. The values are the palette-tier
 * defaults `check:themes` gates (themes.css, "STATUS"); `themes.test.ts`
 * checks them against light and dark grounds.
 */
export function statusVars(dark: boolean): Record<string, string> {
  return dark
    ? {
        "--destructive": hexToHsl("#f87171"),
        "--destructive-foreground": hexToHsl("#0d1117"),
        "--success": hexToHsl("#4ade80"),
        "--success-foreground": hexToHsl("#0d1117"),
        "--warning": hexToHsl("#fbbf24"),
        "--warning-foreground": hexToHsl("#0d1117"),
        "--info": hexToHsl("#93c5fd"),
        "--info-foreground": hexToHsl("#0d1117"),
      }
    : {
        "--destructive": hexToHsl("#c62828"),
        "--destructive-foreground": hexToHsl("#ffffff"),
        "--success": hexToHsl("#166534"),
        "--success-foreground": hexToHsl("#ffffff"),
        "--warning": hexToHsl("#92400e"),
        "--warning-foreground": hexToHsl("#ffffff"),
        "--info": hexToHsl("#1d4ed8"),
        "--info-foreground": hexToHsl("#ffffff"),
      };
}

/** Write the custom palette onto <html>. */
function applyCustomThemeColors(colors: CustomThemeColors): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(customThemeVars(colors))) {
    root.style.setProperty(name, value);
  }
}

/** Remove inline custom-color overrides so preset theme classes win. */
function clearCustomThemeColors(): void {
  const root = document.documentElement;
  THEME_CSS_VARS.forEach((name) => root.style.removeProperty(`--${name}`));
}

/**
 * Mirror the active theme's lightness onto the `dark` class.
 *
 * Tailwind is configured `darkMode: ["class"]`, but nothing ever added that
 * class — `applyTheme` only ever removed it — so every `dark:` variant in the
 * codebase was dead. That was not merely cosmetic: note cards and the rich
 * text editor rely on `dark:prose-invert`, so prose kept its light-theme text
 * colour on all 26 dark presets.
 *
 * Derived from the resolved `--background` lightness rather than a list of
 * preset names, so it holds for custom themes too. Must run after the theme
 * class is applied, since it reads the computed value.
 */
function syncDarkClass(): void {
  const html = document.documentElement;
  const background = getComputedStyle(html).getPropertyValue("--background");
  html.classList.toggle("dark", isDarkBackground(background));
  syncThemeColorMeta(background);
}

/**
 * Keep the `dark` class in step with whatever sets the theme.
 *
 * `applyTheme` syncs it, but next-themes applies a visitor's saved choice
 * (and the command palette's light/dark switch) on its own, without calling
 * it — so on those paths every `dark:` variant was dead again and dark themes
 * showed light-theme greens and ambers at 3:1. Watching the <html> class and
 * style (custom themes set variables inline) covers every path. Toggling
 * `dark` to the state it already has changes nothing, so this cannot loop.
 * Returns the unsubscribe.
 */
export function watchDarkClass(): () => void {
  syncDarkClass();
  const observer = new MutationObserver(() => syncDarkClass());
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  return () => observer.disconnect();
}

/**
 * Tint the browser's own chrome — the mobile address bar, the task switcher —
 * with the active theme's ground.
 *
 * It was a fixed near-black in the root metadata, so on every light preset
 * the page sat under a black bar. The static value is only the default
 * preset's ground; this keeps it in step with whatever is applied, custom
 * themes included.
 */
function syncThemeColorMeta(background: string): void {
  const value = background.trim();
  if (!value) return;
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = "hsl(" + value + ")";
}

/**
 * Apply a theme + typography preset to <html>: swaps theme/typo classes,
 * applies or clears inline custom colors, and persists the choice.
 */
export function applyTheme(
  themeClass: string,
  typographyPreset: string,
  customColors: CustomThemeColors | undefined,
): void {
  const html = document.documentElement;
  html.classList.remove(
    ...VALID_THEMES,
    ...TYPOGRAPHY_CLASSES,
    "dark",
    "light",
  );

  if (themeClass === CUSTOM_THEME && customColors) {
    applyCustomThemeColors(customColors);
  } else {
    clearCustomThemeColors();
  }

  html.classList.add(themeClass);
  if (typographyPreset && typographyPreset !== "typo-default") {
    html.classList.add(typographyPreset);
  }

  syncDarkClass();
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeClass);
  } catch {
    // Persistence is best-effort (storage may be blocked, e.g. Safari
    // private mode); the theme is still applied to the DOM.
  }
}

/**
 * Apply the owner's theme, then a visitor's light/dark choice on top.
 *
 * Which scheme the owner's theme is comes from its resolved ground (the
 * `dark` class `applyTheme` just synced), not a list of names, so custom
 * themes count too. Only a mismatch swaps it: the visitor who asked for dark
 * on a dark theme gets the owner's theme untouched. Both applications run in
 * one task, so nothing paints in between. Returns the class applied.
 */
export function applySiteTheme(
  themeClass: string,
  typographyPreset: string,
  customColors: CustomThemeColors | undefined,
  scheme: Scheme | null = readVisitorScheme(),
): string {
  applyTheme(themeClass, typographyPreset, customColors);
  if (!scheme) return themeClass;
  const isDark = document.documentElement.classList.contains("dark");
  if (isDark === (scheme === "dark")) return themeClass;
  const paired = pairedTheme(themeClass, scheme);
  applyTheme(paired, typographyPreset, undefined);
  return paired;
}
