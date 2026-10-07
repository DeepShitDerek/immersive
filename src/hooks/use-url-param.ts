import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * One query-string value as state: the open note, message or post,
 * so a reload reopens it and it can be linked to. Other
 * parameters are kept. The page must render inside `<Suspense>`, as
 * `useSearchParams` requires for a static export.
 *
 * `defaultMode` "push" makes Back undo a change (opening a message). Full-screen
 * editors use "replace", as Maps does: Back leaves the page, as it always has,
 * rather than tearing an editor down mid-edit.
 */
export function useUrlParam(
  key: string,
  defaultMode: "push" | "replace" = "push",
): [string | null, (value: string | null, mode?: "push" | "replace") => void] {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params?.get(key) ?? null;

  const set = useCallback(
    (next: string | null, mode: "push" | "replace" = defaultMode) => {
      // The live URL, so parameters another hook owns are kept.
      const query = new URLSearchParams(window.location.search);
      if ((query.get(key) ?? null) === next) return;
      if (next === null) query.delete(key);
      else query.set(key, next);
      const suffix = query.toString();
      const url = `${pathname}${suffix ? `?${suffix}` : ""}`;
      if (mode === "replace") router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [key, pathname, router, defaultMode],
  );

  return [value, set];
}
