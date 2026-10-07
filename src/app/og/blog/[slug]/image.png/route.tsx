import { renderOgCard } from "@/lib/og/card";
import {
  fetchPostBySlug,
  fetchPublishedPosts,
  orUndefined,
} from "@/lib/public-data";

// One card per post built at this time; same list as /blog/[slug].
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = (await orUndefined(fetchPublishedPosts())) ?? [];
  const params = posts
    .map((post) => post.slug)
    .filter((slug) => slug && slug !== "view")
    .map((slug) => ({ slug }));
  return params.length > 0 ? params : [{ slug: "_" }];
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  const params = await props.params;
  const post = await orUndefined(fetchPostBySlug(params.slug));
  return renderOgCard({
    eyebrow: post?.tags?.find((tag) => tag.trim()) ?? "Writing",
    title: post?.title ?? "Writing",
    description: post?.excerpt,
  });
}
