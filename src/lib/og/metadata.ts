import type { Metadata } from "next";
import { config as appConfig } from "@/lib/config";

/**
 * Open Graph + Twitter tags for one public page.
 *
 * Every page needs its own: Next replaces a parent's `openGraph` object
 * wholesale rather than merging it, so a site-wide default image set in the
 * root layout would vanish from any page that sets a title. Relative paths
 * resolve against `metadataBase` (NEXT_PUBLIC_SITE_URL).
 */
export function socialMetadata({
  title,
  description,
  path,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  /** The page's own path, e.g. "/work/". */
  path: string;
  /** An owner-chosen image (a cover) or a generated card under /og/. */
  image: string;
  type?: "website" | "article";
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type,
      title,
      description,
      url: path,
      siteName: appConfig.site.title,
      locale: "en_US",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
