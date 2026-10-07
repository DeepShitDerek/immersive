import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while prerendering and during hydration, true from the next render on.
 *
 * Public pages are prerendered at build, so anything rendered from
 * the clock, the timezone or the locale must read the same in the build's HTML
 * and in the browser's first render, or React discards the prerendered markup
 * with a hydration error. Render the stable form until this is true — then
 * the visitor's own ("3d ago", their local date).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * The timezone to format dates in: UTC until hydrated, so the build (which
 * runs in UTC on CI) and the first client render agree; then the visitor's.
 */
export function useDisplayTimeZone(): string | undefined {
  return useHydrated() ? undefined : "UTC";
}
