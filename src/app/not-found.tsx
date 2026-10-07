import type { Metadata } from "next";
import PublicChrome from "@/components/layout/public-chrome";
import { NotFoundView } from "@/features/sections/not-found-view";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/**
 * `404.html` in the export, and the only file a static host serves for a path
 * it does not have — which makes it the one place left to resolve a CMS page
 * created since the last deploy. `NotFoundView` decides which of the two this
 * visit is; see `cms-fallback.ts`.
 *
 * Wrapped in `PublicChrome` because it can now render a real page. Without the
 * header and footer a resolved CMS page would arrive with no navigation and no
 * way back, and the genuine 404 was a bare centred block on a page with no
 * chrome for the same reason. It also means both cases respect the maintenance
 * kill-switch, which this route previously sat outside of.
 */
export default function NotFound() {
  return (
    <PublicChrome>
      <NotFoundView />
    </PublicChrome>
  );
}
