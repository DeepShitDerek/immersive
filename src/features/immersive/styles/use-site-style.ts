"use client";

import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { resolveSiteStyle, type SiteStyle } from "@/lib/site-style";

/**
 * The owner's style. The site identity is in the cache from the build
 * (SeedSiteData), so the static HTML and the first client render agree.
 */
export function useSiteStyle(): SiteStyle {
  const { data } = useGetSiteIdentityQuery();
  return resolveSiteStyle(data?.profile_data?.site_style);
}
