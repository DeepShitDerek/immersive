"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Check, Link2, Linkedin, Twitter } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetBlogPostBySlugQuery,
  useGetPublishedBlogPostsQuery,
} from "@/store/api/publicApi";
import type { BlogPost } from "@/types";
import { PostPage } from "@/features/blog/post-page";
import {
  ARTICLE_ID,
  usePostPage,
  type PrerenderedBody,
} from "@/features/blog/use-post-page";
import { loadPostContent } from "@/features/blog/post-content-loader";
import { postHref } from "@/features/blog/post-href";
import { readTime } from "@/features/blog/post-meta";
import {
  TableOfContents,
  TableOfContentsInline,
} from "@/features/blog/table-of-contents";
import { safeImageUrl } from "@/lib/safe-url";
import { useScene } from "../motion/scroll-provider";
import {
  WithScroll,
  handoffScene,
  progressScene,
  settleScene,
} from "../shared/ruled";
import { nextPost } from "./blog-model";

const PostContent = dynamic(() =>
  loadPostContent().then((mod) => mod.PostContent),
);

const NO_POSTS: BlogPost[] = [];

const ICON_BUTTON =
  "flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast hover:text-foreground focus-ring [@media(pointer:coarse)]:size-11";

const META_LINK =
  "inline-flex min-h-6 items-center rounded-control text-foreground underline decoration-primary underline-offset-4 focus-ring";

function Body({
  slug,
  prerendered,
  builtSlugs,
}: {
  slug: string;
  prerendered?: PrerenderedBody;
  builtSlugs?: readonly string[];
}) {
  const page = usePostPage(slug, prerendered);
  const { data: posts = NO_POSTS } = useGetPublishedBlogPostsQuery();
  const titleRef = useRef<HTMLElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLElement>(null);
  useScene(titleRef, settleScene);
  useScene(readRef, progressScene);
  useScene(nextRef, handoffScene);

  const { post, tags, published, hasToc, headings, activeId } = page;
  if (!post) return null;

  const author = page.identity?.profile_data.name;
  const cover = safeImageUrl(post.cover_image_url);
  const next = nextPost(posts, post.slug);

  return (
    <>
      <header
        ref={titleRef}
        data-part="title"
        className="flex min-h-[calc(100svh-3.5rem)] flex-col justify-between gap-10 overflow-hidden px-[var(--band-x)] pb-8 pt-10 max-[399px]:px-4"
      >
        <p className="im-mono flex justify-between gap-4">
          <Link href="/blog" className={META_LINK}>
            All writing
          </Link>
          {tags[0] && <span>{tags[0]}</span>}
        </p>
        <div data-title className="min-w-0 will-change-transform">
          <h1 className="im-display im-display-lg !normal-case">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="t-lead mt-6 max-w-prose text-pretty">
              {post.excerpt}
            </p>
          )}
        </div>
        <p className="im-mono min-h-6">
          {author && <span className="text-foreground">{author}</span>}
          {author && <span aria-hidden> · </span>}
          {published && (
            <time dateTime={post.published_at ?? undefined}>{published}</time>
          )}
          {published && <span aria-hidden> · </span>}
          {readTime(post)} min read
        </p>
      </header>

      <div ref={readRef} data-part="reading" className="im-rule relative">
        {/* Decoration: the same information is the scrollbar. Hidden without motion. */}
        <div
          aria-hidden
          data-progress
          className="sticky top-14 z-10 h-0.5 origin-left scale-x-0 bg-primary motion-reduce:hidden"
        />
        <div className="grid gap-x-12 px-[var(--band-x)] py-16 max-[399px]:px-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="hidden lg:block">
            {hasToc && (
              <TableOfContents headings={headings} activeId={activeId} />
            )}
          </div>
          {/* The reading column: no scroll effects here, by rule. */}
          <article id={ARTICLE_ID} className="min-w-0 max-w-prose">
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt=""
                fetchPriority="high"
                className="mb-10 w-full rounded-surface object-cover"
              />
            )}
            {hasToc && (
              <TableOfContentsInline headings={headings} activeId={activeId} />
            )}
            <div className={hasToc ? "mt-10 lg:mt-0" : undefined}>
              {page.builtIsCurrent ? (
                prerendered?.body
              ) : (
                <PostContent content={post.content ?? ""} />
              )}
            </div>

            <footer className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-border pt-8">
              {tags.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Topics">
                  {tags.map((tag) => (
                    <li key={tag}>
                      <Link
                        href={`/blog?tag=${encodeURIComponent(tag)}`}
                        className="im-mono inline-flex min-h-8 items-center rounded-full border border-border px-3 transition-colors duration-fast hover:border-foreground hover:text-foreground focus-ring"
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
                <span className="im-mono mr-1">Share</span>
                <button
                  type="button"
                  onClick={() => page.share("x")}
                  aria-label="Share on X"
                  title="Share on X"
                  className={ICON_BUTTON}
                >
                  <Twitter className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => page.share("linkedin")}
                  aria-label="Share on LinkedIn"
                  title="Share on LinkedIn"
                  className={ICON_BUTTON}
                >
                  <Linkedin className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={page.copyLink}
                  aria-label={page.copied ? "Link copied" : "Copy link"}
                  title={page.copied ? "Link copied" : "Copy link"}
                  className={ICON_BUTTON}
                >
                  {page.copied ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Link2 className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </footer>
          </article>
        </div>
      </div>

      {next && (
        <section
          ref={nextRef}
          data-part="handoff"
          aria-label="Next post"
          className="im-rule flex min-h-[80svh] flex-col justify-between gap-10 overflow-hidden px-[var(--band-x)] py-10 max-[399px]:px-4"
        >
          <p aria-hidden className="im-mono">
            Next post
          </p>
          <h2
            data-next
            className="im-display im-display-lg !normal-case will-change-transform"
          >
            <Link
              href={postHref(next.slug, builtSlugs)}
              className="rounded-control decoration-primary decoration-4 underline-offset-[0.12em] hover:underline focus-ring"
            >
              {next.title}
            </Link>
          </h2>
          <span />
        </section>
      )}
    </>
  );
}

/**
 * A post in an immersive style: a title card, the reading layout with the
 * table of contents alongside, and a hand-off to the next post.
 *
 * What the page does (view counting, the build-time body, sharing) is
 * `usePostPage`, the hook the Classic page calls. Loading and not-found are
 * the Classic page's own states, restyled by the scope.
 */
export default function ImmersivePost({
  slug,
  prerendered,
  builtSlugs,
}: {
  slug: string;
  prerendered?: PrerenderedBody;
  /** Slugs prerendered at the last build; see postHref. */
  builtSlugs?: readonly string[];
}) {
  return (
    <Gate slug={slug} prerendered={prerendered}>
      <WithScroll>
        <Body slug={slug} prerendered={prerendered} builtSlugs={builtSlugs} />
      </WithScroll>
    </Gate>
  );
}

/**
 * Classic's states until there is a post to lay out. Only the query is read
 * here: `usePostPage` counts a view, so it must run once, in `Body`.
 */
function Gate({
  slug,
  prerendered,
  children,
}: {
  slug: string;
  prerendered?: PrerenderedBody;
  children: React.ReactNode;
}) {
  const {
    data: post,
    isLoading,
    isError,
  } = useGetBlogPostBySlugQuery(slug || skipToken);
  if (!slug || isError || isLoading || !post)
    return <PostPage slug={slug} prerendered={prerendered} />;
  return <>{children}</>;
}
