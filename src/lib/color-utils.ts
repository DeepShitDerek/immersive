/**
 * Pull the lightness percentage out of an HSL token value such as
 * `"220 13% 9%"` — the shape every theme preset stores its colours in.
 * Returns null for anything that is not in that shape.
 */
function lightnessOf(hslToken: string): number | null {
  const parts = hslToken.trim().split(/\s+/);
  if (parts.length < 3) return null;
  const lightness = Number.parseFloat(parts[2]);
  return Number.isFinite(lightness) ? lightness : null;
}

/** Below this the surrounding UI reads as dark. */
const DARK_LIGHTNESS_THRESHOLD = 50;

/**
 * Whether a resolved `--background` token reads as a dark surface.
 *
 * Derived from lightness rather than a list of preset names, so it holds for
 * all 52 presets and for custom themes, which have no name at all. An
 * unreadable token means no theme has been applied yet; light is the app
 * default and the safer guess.
 */
export function isDarkBackground(hslToken: string): boolean {
  const lightness = lightnessOf(hslToken);
  if (lightness === null) return false;
  return lightness < DARK_LIGHTNESS_THRESHOLD;
}

/**
 * Convert a hex color to HSL format for CSS variables.
 * Supports #RGB and #RRGGBB formats.
 */
export function hexToHsl(hex: string): string {
  let r = 0,
    g = 0,
    b = 0;

  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }

  r /= 255;
  g /= 255;
  b /= 255;

  const cmin = Math.min(r, g, b);
  const cmax = Math.max(r, g, b);
  const delta = cmax - cmin;

  let h = 0;
  let s = 0;
  let l = 0;

  if (delta === 0) {
    h = 0;
  } else if (cmax === r) {
    h = ((g - b) / delta) % 6;
  } else if (cmax === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  l = (cmax + cmin) / 2;
  s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return `${h} ${s}% ${l}%`;
}

/* ---------------------------------------------------------------------------
 * Contrast
 *
 * The WCAG maths used to live only inside `theme-contrast.test.ts`, which gates
 * the 52 presets at build time. The settings screen now lets the owner pick six
 * arbitrary hex colours for `theme-custom`, and those never go through that
 * test — nothing in CI can check a value that is typed at runtime. So the same
 * calculation has to be reachable from the app, and it must be the *same* one:
 * a second implementation that rounds differently would let the UI approve a
 * palette the build would reject.
 * ------------------------------------------------------------------------- */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** WCAG AA for normal-size text. */
export const AA_NORMAL_TEXT = 4.5;

/** Parse a `"220 13% 9%"` design token. Null for anything not in that shape. */
export function parseHslToken(token: string): Hsl | null {
  const match = token.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) return null;
  return {
    h: Number.parseFloat(match[1]),
    s: Number.parseFloat(match[2]),
    l: Number.parseFloat(match[3]),
  };
}

/** HSL to linear 0-1 RGB. */
function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

/** WCAG relative luminance of an sRGB triple given as 0-1 channels. */
function relativeLuminance(rgb: [number, number, number]): number {
  const channel = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two HSL colours, 1:1 to 21:1. */
export function contrastRatio(a: Hsl, b: Hsl): number {
  const la = relativeLuminance(hslToRgb(a));
  const lb = relativeLuminance(hslToRgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Contrast ratio between two hex colours — what the custom-theme form holds.
 *
 * Returns null when either value is not a colour we can read, so the caller
 * shows "cannot check" rather than a confident number derived from `#000`.
 */
export function contrastRatioHex(a: string, b: string): number | null {
  // `hexToHsl` parses digit-by-digit and yields "0 0% 0%" for anything it does
  // not understand, so an unvalidated call reports pure black with total
  // confidence. Check the shape first.
  if (!isHexColor(a) || !isHexColor(b)) return null;
  const ha = parseHslToken(hexToHsl(a));
  const hb = parseHslToken(hexToHsl(b));
  if (!ha || !hb) return null;
  return contrastRatio(ha, hb);
}

/** `#RGB` or `#RRGGBB` — the two forms `hexToHsl` can actually read. */
function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}
