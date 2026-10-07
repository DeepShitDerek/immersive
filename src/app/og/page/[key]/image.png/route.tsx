import { renderOgCard } from "@/lib/og/card";
import { OG_PAGES, type OgPageKey } from "@/lib/og/pages";

// Rendered to out/og/page/<key>/image.png at build.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(OG_PAGES).map((key) => ({ key }));
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ key: string }> },
) {
  const params = await props.params;
  return renderOgCard(OG_PAGES[params.key as OgPageKey]);
}
