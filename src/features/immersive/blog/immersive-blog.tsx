"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import type { BlogPost } from "@/types";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { usePostList } from "@/features/blog/use-post-list";
import { postHref } from "@/features/blog/post-href";
import { formatPostDate, readTime } from "@/features/blog/post-meta";
import { siteContent } from "@/lib/site-content";
import { Input } from "@/components/ui/input";
import { useScene } from "../motion/scroll-provider";
import { Chip, PageTitle, Rule, WithScroll, ruleScene } from "../shared/ruled";

const ACTION =
  "im-mono mt-6 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border px-3 text-foreground transition-colors duration-fast hover:border-foreground focus-ring";

/**
 * A post's tag links land here as ?tag=. Read once after hydration, so the
 * static HTML still holds the whole list; kept in its own Suspense boundary
 * because, under static export, useSearchParams opts its boundary out of
 * prerendering.
 */
function InitialTag({ onTag }: { onTag: (tag: string) => void }) {
  const initial = useSearchParams()?.get("tag");
  useEffect(() => {
    if (initial) onTag(initial);
  }, [initial, onTag]);
  return null;
}

function Row({ post, href }: { post: BlogPost; href: string }) {
  const timeZone = useDisplayTimeZone();
  const topics = (post.tags ?? []).filter((t) => t.trim()).slice(0, 3);
  return (
    <li data-row>
      <Rule />
      <div className="grid gap-x-10 gap-y-2 py-7 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <h2 className="im-display im-display-md !normal-case">
            <Link
              href={href}
              className="rounded-control decoration-primary decoration-2 underline-offset-[0.15em] hover:underline focus-ring"
            >
              {post.title}
            </Link>
          </h2>
          {post.excerpt && (
            <p className="mt-3 max-w-prose text-base leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          )}
          {topics.length > 0 && (
            <p className="im-mono mt-3">{topics.join(" · ")}</p>
          )}
        </div>
        <p className="im-mono lg:pt-2 lg:text-right">
          {post.published_at && (
            <time dateTime={post.published_at}>
              {formatPostDate(post.published_at, timeZone)}
            </time>
          )}
          {post.published_at && <span aria-hidden> · </span>}
          {readTime(post)} min read
        </p>
      </div>
    </li>
  );
}

/**
 * The writing index in an immersive style: a ruled list of large titles.
 * What it does (search, topic filter, the empty and error states) is
 * `usePostList`, the same hook the Classic page calls.
 */
function Page({
  builtSlugs,
}: {
  /** Slugs prerendered at the last build; see postHref. */
  builtSlugs?: readonly string[];
} = {}) {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, ruleScene);
  const {
    isLoading,
    isError,
    refetch,
    searchTerm,
    setSearchTerm,
    tag,
    setTag,
    tags,
    filtered,
    filtering,
    clear,
  } = usePostList();

  return (
    <>
      <section
        ref={ref}
        data-page="blog"
        className="px-[var(--band-x)] pb-24 pt-12 max-[399px]:px-4 md:pt-20"
      >
        <Suspense fallback={null}>
          <InitialTag onTag={setTag} />
        </Suspense>
        <PageTitle
          title={siteContent.pages.blog.title}
          lead={siteContent.pages.blog.description}
        />

        <div className="mb-10 mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search
              aria-hidden
              className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search posts…"
              aria-label="Search posts"
              className="h-11 pl-11"
            />
          </div>
          {tags.length > 0 && (
            <ul aria-label="Filter by topic" className="flex flex-wrap gap-2">
              <li>
                <Chip active={tag === null} onClick={() => setTag(null)}>
                  All
                </Chip>
              </li>
              {tags.map(({ tag: name, count }) => (
                <li key={name}>
                  <Chip
                    active={tag === name}
                    count={count}
                    onClick={() => setTag(tag === name ? null : name)}
                  >
                    {name}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-6" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="im-rule h-24" />
            ))}
          </div>
        ) : isError ? (
          <div role="alert" className="im-rule py-14">
            <p className="im-display im-display-md !normal-case">
              The posts didn&apos;t load
            </p>
            <p className="mt-3 text-base text-muted-foreground">
              Nothing is lost — it&apos;s the connection, not the writing.
            </p>
            <button type="button" className={ACTION} onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="im-rule py-14">
            <p className="im-display im-display-md !normal-case">
              {filtering ? "No posts match" : "Nothing published yet"}
            </p>
            <p className="mt-3 text-base text-muted-foreground">
              {filtering
                ? "Try a different word or topic."
                : "The first post is on its way."}
            </p>
            {filtering && (
              <button type="button" className={ACTION} onClick={clear}>
                <X className="size-3.5" aria-hidden />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ol>
            {filtered.map((post) => (
              <Row
                key={post.id}
                post={post}
                href={postHref(post.slug, builtSlugs)}
              />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

/*
  The page is rendered inside the provider, not around it: `useScene` reads
  the provider's context, so a component that called the hook and then
  rendered the provider as its own child would never get a scene.
*/
export default function ImmersiveBlog(
  props: { builtSlugs?: readonly string[] } = {},
) {
  return (
    <WithScroll>
      <Page {...props} />
    </WithScroll>
  );
}
