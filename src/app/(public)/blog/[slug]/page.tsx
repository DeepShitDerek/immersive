import type { Metadata } from "next";
import { config as appConfig } from "@/lib/config";
import {
  fetchPostBySlug,
  fetchPublishedPosts,
  orUndefined,
} from "@/lib/public-data";
import { safeImageUrl } from "@/lib/safe-url";
import { socialMetadata } from "@/lib/og/metadata";
import { PostPage } from "@/features/blog/post-page";
import { PostBody } from "@/features/blog/post-body";
import { contentHash } from "@/features/blog/content-hash";
import { PublicPreload } from "@/store/public-preload";
import { pagePreload } from "@/lib/public-preload-server";
import { StyleSwitch } from "@/features/immersive/style-switch";

/*
  One prerendered page per post published at build time.
  Each gets its own <title>, description and link preview, which the old
  single /blog/view/?slug= page could not have. Posts published since the
  last build are served by /blog/view until the next one (see postHref).
*/

// Static export: only build-time params exist.
export const dynamicParams = false;

/** A slug that would shadow a real route under /blog. */
const RESERVED = new Set(["view"]);

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const posts = (await orUndefined(fetchPublishedPosts())) ?? [];
  const params = posts
    .map((post) => post.slug)
    .filter((slug) => slug && !RESERVED.has(slug))
    .map((slug) => ({ slug }));
  // `output: export` rejects an empty list; emit one unlinked sentinel, which
  // renders the post's not-found view.
  return params.length > 0 ? params : [{ slug: "_" }];
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const post = await orUndefined(fetchPostBySlug(params.slug));
  if (!post) return { title: "Post not found", robots: { index: false } };

  const path = `/blog/${encodeURIComponent(post.slug)}/`;
  const description = post.excerpt || appConfig.site.description;
  const social = socialMetadata({
    title: post.title,
    description,
    path,
    // The owner's cover when there is one; otherwise the card built for
    // this post.
    image:
      safeImageUrl(post.cover_image_url) ??
      `/og/blog/${encodeURIComponent(post.slug)}/image.png`,
    type: "article",
  });

  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    ...social,
    openGraph: {
      ...social.openGraph,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at ?? undefined,
      tags: post.tags ?? undefined,
    },
  };
}

export default async function Page(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  // The post list too (titles and slugs, no bodies): the immersive hand-off
  // names the next post, and that belongs in the HTML.
  const [post, list] = await Promise.all([
    orUndefined(fetchPostBySlug(params.slug)),
    pagePreload({ posts: true }),
  ]);
  const prerendered = post
    ? {
        contentHash: contentHash(post.content ?? ""),
        body: <PostBody content={post.content ?? ""} />,
      }
    : undefined;
  return (
    <PublicPreload
      data={{
        ...list,
        ...(post ? { postsBySlug: { [params.slug]: post } } : {}),
      }}
    >
      <StyleSwitch
        layout="post"
        slug={params.slug}
        prerendered={prerendered}
        builtSlugs={(list.posts ?? []).map((item) => item.slug)}
        classic={<PostPage slug={params.slug} prerendered={prerendered} />}
      />
    </PublicPreload>
  );
}
