"use client";

import { useUrlParam } from "./use-url-param";

/**
 * A second-level tab kept in the URL as `?tab=` (workspace contract: context
 * in the URL). Reload, Back and a bookmark all return to the tab you were on;
 * Money's sub-tabs used to reset to the first on every visit. The default
 * tab leaves the URL clean, and an unknown value falls back to it.
 */
export function useUrlTab<T extends string>(
  defaultValue: T,
  allowed: readonly T[],
): [T, (next: string) => void] {
  const [raw, set] = useUrlParam("tab", "replace");
  const value = (allowed as readonly string[]).includes(raw ?? "")
    ? (raw as T)
    : defaultValue;
  return [value, (next: string) => set(next === defaultValue ? null : next)];
}
