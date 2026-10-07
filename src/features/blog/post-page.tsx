"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, Check, Link2, Linkedin, Twitter } from "lucide-react";
import { safeImageUrl } from "@/lib/safe-url";
import { sizedImageUrl } from "@/lib/image-size";
import { Band } from "@/components/layout/band";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { readTime } from "./post-meta";
import { loadPostContent } from "./post-content-loader";
import { ReadingProgress } from "./reading-progress";
import { ARTICLE_ID, usePostPage, type PrerenderedBody } from "./use-post-page";
import { TableOfContents, TableOfContentsInline } from "./table-of-contents";

// The markdown pipeline (raw → sanitize → prism/refractor → slug) is by far the
// heaviest thing on this route, and nothing above the article body needs it.
// Splitting it lets the title and cover paint on the light chunk.
//
// Rendered at build, not only in the browser: a prerendered post's
// body is in its HTML — the part of a blog search engines and link previews
// actually read. The chunk is still split; first-load JS is unchanged.
const PostContent = dynamic(
  () => loadPostContent().then((mod) => mod.PostContent),
  {
    loading: () => (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    ),
  },
);

const ICON_BUTTON =
  "flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground focus-ring [@media(pointer:coarse)]:size-11";

/** "status: 404 — post not found" was the v2 terminal voice. */
function PostNotFound() {
  return (
    <Band weight="feature">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <p className="t-eyebrow">Post not found</p>
        <h1 className="t-title mt-4 text-balance">
          This post doesn&apos;t exist.
        </h1>
        <p className="t-lead mt-4 text-pretty">
          It may have been unpublished, or the link may be mistyped.
        </p>
        <Button asChild size="lg" className="mt-10">
          <Link href="/blog">
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            All posts
          </Link>
        </Button>
      </div>
    </Band>
  );
}

export type { PrerenderedBody } from "./use-post-page";

export function PostPage({
  slug,
  prerendered,
}: {
  slug: string;
  prerendered?: PrerenderedBody;
}) {
  const {
    post,
    isLoading,
    isError,
    identity,
    headings,
    activeId,
    builtIsCurrent,
    hasToc,
    tags,
    published,
    copied,
    share,
    copyLink,
  } = usePostPage(slug, prerendered);

  if (!slug || isError) return <PostNotFound />;

  if (isLoading || !post) {
    return (
      <Band weight="content" width="prose" aria-busy>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-8 h-14 w-3/4" />
        <Skeleton className="mt-6 h-5 w-56" />
        <Skeleton className="mt-10 h-72 w-full rounded-surface" />
      </Band>
    );
  }

  const author = identity?.profile_data;
  const avatar = author?.show_profile_picture
    ? safeImageUrl(author.profile_picture_url)
    : null;
  const cover = safeImageUrl(post.cover_image_url);

  return (
    <>
      <ReadingProgress />
      <Band weight="content">
        {/*
          One left edge. The post sat in the wide band (84rem) while
          the header and every other page use the content width, its body was
          centred in its column, and the contents rail sat on the right: three
          different left edges on one page. Now the band is the content width
          and, from lg, a 12rem margin rail on the left holds the contents, as
          the home page's rows hold their dates. The article reads at the
          prose measure beside it.
        */}
        <div className="grid gap-x-12 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="hidden lg:block">
            {hasToc && (
              <TableOfContents headings={headings} activeId={activeId} />
            )}
          </div>

          <article id={ARTICLE_ID} className="min-w-0 max-w-prose">
            <header>
              <Link
                href="/blog"
                className="group inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-ring"
              >
                <ArrowLeft
                  className="size-4 transition-transform duration-fast group-hover:-translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
                All writing
              </Link>

              {tags[0] && <p className="t-eyebrow mt-10">{tags[0]}</p>}
              <h1
                className={cn(
                  "t-title text-balance [overflow-wrap:anywhere]",
                  tags[0] ? "mt-3" : "mt-10",
                )}
              >
                {post.title}
              </h1>
              {post.excerpt && (
                <p className="t-lead mt-5 text-pretty">{post.excerpt}</p>
              )}

              <div className="mt-8 flex items-center gap-3">
                {avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sizedImageUrl(avatar, 40)}
                    alt=""
                    width={40}
                    height={40}
                    decoding="async"
                    className="size-10 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0 text-sm">
                  {author?.name && (
                    <p className="font-semibold">{author.name}</p>
                  )}
                  <p className="font-mono text-micro text-muted-foreground">
                    {published && (
                      <time dateTime={post.published_at ?? undefined}>
                        {published}
                      </time>
                    )}
                    {published && " · "}
                    {readTime(post)} min read
                  </p>
                </div>
              </div>

              {cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  // Usually the largest thing above the fold (the LCP).
                  fetchPriority="high"
                  className="mt-10 w-full rounded-surface object-cover"
                />
              )}

              {hasToc && (
                <TableOfContentsInline
                  headings={headings}
                  activeId={activeId}
                />
              )}
            </header>

            <div className="mt-12">
              {builtIsCurrent ? (
                prerendered?.body
              ) : (
                <PostContent content={post.content ?? ""} />
              )}
            </div>

            <footer className="mt-16">
              <div className="flex flex-wrap items-center justify-between gap-6 border-t border-border pt-8">
                {tags.length > 0 ? (
                  <ul className="flex flex-wrap gap-2" aria-label="Topics">
                    {tags.map((tag) => (
                      <li key={tag}>
                        <Link
                          href={`/blog?tag=${encodeURIComponent(tag)}`}
                          className="inline-flex min-h-6 items-center rounded-full border border-border px-3 py-1 font-mono text-micro text-muted-foreground transition-colors duration-fast hover:border-input hover:text-foreground focus-ring"
                        >
                          {tag}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <span className="mr-1 text-sm text-muted-foreground">
                    Share
                  </span>
                  <button
                    type="button"
                    onClick={() => share("x")}
                    aria-label="Share on X"
                    title="Share on X"
                    className={ICON_BUTTON}
                  >
                    <Twitter className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => share("linkedin")}
                    aria-label="Share on LinkedIn"
                    title="Share on LinkedIn"
                    className={ICON_BUTTON}
                  >
                    <Linkedin className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    aria-label={copied ? "Link copied" : "Copy link"}
                    title={copied ? "Link copied" : "Copy link"}
                    className={ICON_BUTTON}
                  >
                    {copied ? (
                      <Check className="size-4" aria-hidden />
                    ) : (
                      <Link2 className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
              </div>
            </footer>
          </article>
        </div>
      </Band>
    </>
  );
}
