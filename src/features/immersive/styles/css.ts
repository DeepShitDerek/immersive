import { hexToHsl } from "@/lib/color-utils";
import { STYLE_DEFINITIONS } from "./index";
import type { StyleDefinition } from "./types";

/**
 * Status and chart colours are per scheme, not per style: they carry meaning,
 * not brand. The values are the Field Notes light and dark themes', which the
 * workspace's charts and badges are checked against.
 */
const STATUS: Record<StyleDefinition["scheme"], Record<string, string>> = {
  dark: {
    "--success": "142 60% 55%",
    "--warning": "38 92% 60%",
    "--info": "208 80% 68%",
    "--destructive": "4 85% 68%",
    "--chart-1": "235 90% 78%",
    "--chart-2": "172 55% 55%",
    "--chart-3": "38 85% 60%",
    "--chart-4": "340 70% 68%",
    "--chart-5": "208 75% 65%",
  },
  light: {
    "--success": "142.4 71.8% 29.2%",
    "--warning": "33.1 91.7% 32.9%",
    "--info": "208.5 66.3% 36.1%",
    "--destructive": "4.2 76.5% 40%",
    "--chart-1": "235 58% 50%",
    "--chart-2": "172 60% 33%",
    "--chart-3": "33 90% 40%",
    "--chart-4": "340 65% 48%",
    "--chart-5": "208 66% 45%",
  },
};

/**
 * A style as the design tokens the public components already read
 * (themes.css), so a page is restyled by scope with no component changes.
 */
export function styleVars(def: StyleDefinition): Record<string, string> {
  const c = def.colors;
  const page = hexToHsl(c.page);
  const surface = hexToHsl(c.surface);
  const text = hexToHsl(c.text);
  const onStatus = def.scheme === "dark" ? page : "0 0% 100%";
  return {
    "--background": page,
    "--foreground": text,
    "--card": surface,
    "--card-foreground": text,
    "--popover": surface,
    "--popover-foreground": text,
    "--primary": hexToHsl(c.accent),
    "--primary-foreground": hexToHsl(c.onAccent),
    "--secondary": surface,
    "--secondary-foreground": text,
    "--muted": surface,
    "--muted-foreground": hexToHsl(c.muted),
    "--accent": surface,
    "--accent-foreground": text,
    "--border": hexToHsl(c.hairline),
    "--input": hexToHsl(c.control),
    "--ring": hexToHsl(c.accent),
    ...STATUS[def.scheme],
    "--success-foreground": onStatus,
    "--warning-foreground": onStatus,
    "--info-foreground": onStatus,
    "--destructive-foreground": onStatus,
    "--e-shadow": page,
    "--font-heading": def.fonts.display,
    "--font-body": def.fonts.text,
    "--heading-weight": String(def.display.weight),
    // Flat surfaces: a hairline, no drop shadow. Redefined here because the
    // theme defines these on <html>, where var(--border) is the theme's.
    "--e-1": "0 0 0 1px hsl(var(--border))",
    "--e-2": "0 0 0 1px hsl(var(--border))",
    "--e-3": "0 0 0 1px hsl(var(--border))",
    // Ordinary headings on the restyled pages. The display tracking is for
    // display sizes only; at 18px it makes letters touch.
    "--heading-letter-spacing": "-0.02em",
    "--im-display-tracking": def.display.tracking,
    "--im-display-leading": def.display.leading,
    "--im-display-case": def.display.uppercase ? "uppercase" : "none",
  };
}

/**
 * Styles whose display face is cut in one weight. A workspace heading asks
 * for semibold; a faked bold clots the face at small sizes, so the document
 * draws it as cut (immersive.css says the same inside a public scope).
 */
const ONE_WEIGHT_DISPLAY: ReadonlySet<string> = new Set(["paper"]);

/**
 * The stylesheet for all three styles. Built only from the constants above:
 * no setting or user input reaches this string.
 *
 * Two rules per style:
 *
 * - `[data-style-scope]` restyles what is inside the marked element: the page
 *   itself, and the settings preview.
 * - `html:has([data-style-root])` sets the same tokens on the document when
 *   the owner's style is immersive (shell/document-style.tsx puts the marker
 *   on every page, public and workspace), so every screen is in the style,
 *   and so is what is drawn under <body>: toasts, menus, dialogs.
 *   `!important`, because <html> already carries the owner's theme class and,
 *   for a custom theme, the same properties inline. It keys on the shell's
 *   own marker and not on `data-style-scope`, which the preview frame in the
 *   admin also carries: an unsaved style being previewed must not restyle
 *   the workspace around it.
 */
export function styleCss(): string {
  return Object.values(STYLE_DEFINITIONS)
    .map((def) => {
      const vars = Object.entries(styleVars(def));
      const scope = vars.map(([name, value]) => `${name}:${value}`).join(";");
      const root = [
        ...vars,
        ["color-scheme", def.scheme],
        ...(ONE_WEIGHT_DISPLAY.has(def.id)
          ? [["font-synthesis", "style"]]
          : []),
      ]
        .map(([name, value]) => `${name}:${value} !important`)
        .join(";");
      return (
        `[data-style-scope="${def.id}"]{${scope};color-scheme:${def.scheme}}` +
        `html:has([data-style-root="${def.id}"]){${root}}`
      );
    })
    .join("");
}
