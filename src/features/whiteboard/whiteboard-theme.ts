/**
 * Excalidraw ships its own two-tone theme and takes a `"light" | "dark"` prop,
 * so it cannot follow the app's 32 presets directly. Rather than maintaining a
 * list of which preset names are dark, read the lightness out of the resolved
 * `--background` token — that works for every preset and for custom themes,
 * which have no name at all.
 */
import { isDarkBackground } from "@/lib/color-utils";

export type ExcalidrawTheme = "light" | "dark";

/**
 * Re-exported so the whiteboard's own tests and callers keep one import site.
 * The implementation moved to `lib/color-utils` once `applyTheme` needed the
 * same lightness derivation to set the `dark` class — a feature is the wrong
 * owner for a contract that `lib` depends on.
 */
function themeForBackground(hslToken: string): ExcalidrawTheme {
  return isDarkBackground(hslToken) ? "dark" : "light";
}

/** Read the theme currently applied to <html>. */
export function currentExcalidrawTheme(): ExcalidrawTheme {
  if (typeof window === "undefined") return "light";
  const background = getComputedStyle(
    document.documentElement,
  ).getPropertyValue("--background");
  return themeForBackground(background);
}
