import type { Metadata } from "next";
import { socialMetadata } from "@/lib/og/metadata";
import { ogPageImage } from "@/lib/og/pages";
import { config as appConfig } from "@/lib/config";
import { isSupabaseConfigured } from "@/lib/config";
import { rest } from "@/lib/rest";
import { MOCK_NAV_LINKS } from "@/lib/fallback-data";
import { RESERVED_SEGMENTS } from "@/lib/constants";
import { CmsPage } from "@/features/sections/cms-page";
import { pagePreload } from "@/lib/public-preload-server";
import { PublicPreload } from "@/store/public-preload";

// Static export: only build-time params exist; anything else 404s.
export const dynamicParams = false;

async function getNavLinks(): Promise<{ label: string; href: string }[]> {
  if (isSupabaseConfigured && rest) {
    const { data } = await rest
      .from("navigation_links")
      .select("label, href")
      .eq("is_visible", true);
    return data ?? [];
  }
  return MOCK_NAV_LINKS;
}

function toSlug(href: string): string[] | null {
  const clean = href.replace(/^\//, "");
  const root = clean.split("/")[0];
  const reserved: readonly string[] = RESERVED_SEGMENTS;
  if (href === "/" || !clean || reserved.includes(root)) return null;
  return clean.split("/");
}

export async function generateStaticParams(): Promise<{ slug: string[] }[]> {
  const links = await getNavLinks();
  const params = links
    .map((link) => toSlug(link.href))
    .filter((slug): slug is string[] => slug !== null)
    .map((slug) => ({ slug }));
  // `output: export` rejects an empty result as "missing generateStaticParams";
  // when no custom CMS pages exist, emit one unlinked sentinel path instead.
  return params.length > 0 ? params : [{ slug: ["_"] }];
}

async function pageTitle(slug: string[]): Promise<string> {
  const pagePath = `/${slug.join("/")}`;
  const links = await getNavLinks();
  const label = links.find((link) => link.href === pagePath)?.label;
  if (label) return label;
  const last = slug[slug.length - 1] ?? "";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const title = await pageTitle(params.slug);
  // CMS pages have no card of their own; the home card still says whose
  // site it is, which beats a preview with no image at all.
  return {
    title,
    ...socialMetadata({
      title,
      description: appConfig.site.description,
      path: `/${params.slug.join("/")}/`,
      image: ogPageImage("home"),
    }),
  };
}

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const params = await props.params;
  const pagePath = `/${params.slug.join("/")}`;
  const [title, data] = await Promise.all([
    pageTitle(params.slug),
    pagePreload({ sections: [pagePath] }),
  ]);
  return (
    <PublicPreload data={data}>
      <CmsPage pagePath={pagePath} title={title} />
    </PublicPreload>
  );
}
