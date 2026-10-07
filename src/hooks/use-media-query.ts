import { useEffect, useState } from "react";

/**
 * Track a CSS media query from JavaScript.
 *
 * Needed wherever a breakpoint decides *structure* rather than styling — a
 * Radix `Sheet` hidden with `lg:hidden` still mounts, still renders its overlay
 * and still traps focus, so "hide it with a class" is not an answer for a
 * dialog that should only exist on small screens.
 *
 * `useIsMobile` delegates to this rather than carrying a second copy of the
 * listener; it is pinned to `md`, and callers that split at a different
 * breakpoint pass their own query.
 */
export function useMediaQuery(query: string): boolean {
  // `false` on the server and on first paint. A static export hydrates into an
  // unknown viewport, and a layout that assumes "narrow" would flash the mobile
  // arrangement on every desktop load.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);

    sync();
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);

  return matches;
}

/** Tailwind's breakpoints, for the queries that name one. */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

/** `true` below the named Tailwind breakpoint. */
export function useBelowBreakpoint(name: keyof typeof BREAKPOINTS): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS[name] - 1}px)`);
}
