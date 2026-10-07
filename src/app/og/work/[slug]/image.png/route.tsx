import { renderOgCard } from "@/lib/og/card";
import { plainPreview } from "@/lib/text-preview";
import {
  fetchCaseStudyBySlug,
  fetchCaseStudySlugs,
  orUndefined,
} from "@/lib/public-data";

// One card per case study built at this time; same list as /work/[slug].
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = (await orUndefined(fetchCaseStudySlugs())) ?? [];
  const params = slugs
    .filter((slug) => slug !== "view")
    .map((slug) => ({ slug }));
  return params.length > 0 ? params : [{ slug: "_" }];
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const params = await props.params;
  const study = await orUndefined(fetchCaseStudyBySlug(params.slug));
  return renderOgCard({
    eyebrow: study?.subtitle?.trim() || "Case study",
    title: study?.title ?? "Case study",
    description: study?.description ? plainPreview(study.description) : null,
  });
}
