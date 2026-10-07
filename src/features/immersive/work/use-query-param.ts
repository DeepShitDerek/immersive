"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "im:query";

function subscribe(notify: () => void): () => void {
  window.addEventListener("popstate", notify);
  window.addEventListener(EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(EVENT, notify);
  };
}

/**
 * One query parameter, read and written without `useSearchParams`.
 *
 * `useSearchParams` makes a static export render its Suspense fallback, which
 * would leave the list out of the HTML. Here the server snapshot is "no
 * value", so the build renders the unfiltered page and the filter applies
 * once the browser knows the URL.
 */
export function useQueryParam(
  name: string,
): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => null,
  );
  const set = useCallback(
    (next: string | null) => {
      const url = new URL(window.location.href);
      if (next) url.searchParams.set(name, next);
      else url.searchParams.delete(name);
      window.history.replaceState(window.history.state, "", url);
      window.dispatchEvent(new Event(EVENT));
    },
    [name],
  );
  return [value, set];
}
