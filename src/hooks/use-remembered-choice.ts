import { useCallback, useEffect, useState } from "react";

/**
 * A view choice remembered in this browser: board or list, week or
 * month, grid or table. They reset on every visit before.
 *
 * Read after mount, not in the initial state: the page is prerendered with
 * the default, and reading storage during the first render would make the
 * client's first paint disagree with that HTML. A stored value that is no
 * longer an option (a view since removed) is ignored.
 */
export function useRememberedChoice<T extends string>(
  key: string,
  initial: T,
  options: readonly T[],
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const storageKey = `admin-view:${key}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && (options as readonly string[]).includes(stored))
        setValue(stored as T);
    } catch {
      // Storage blocked: the default it is.
    }
    // The options are a constant per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const choose = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // As above.
      }
    },
    [storageKey],
  );

  return [value, choose];
}
