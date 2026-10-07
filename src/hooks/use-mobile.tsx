import { useBelowBreakpoint } from "./use-media-query";

/**
 * `true` below Tailwind's `md`.
 *
 * Delegates to `useMediaQuery` so there is one media-query listener in the
 * codebase rather than one per breakpoint that happens to be needed.
 */
export function useIsMobile(): boolean {
  return useBelowBreakpoint("md");
}
