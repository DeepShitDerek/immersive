"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { postHref } from "./post-href";
import { usePostList } from "./use-post-list";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { Eye, Search, X } from "lucide-react";
import type { BlogPost } from "@/types";
import { formatPostDate, readTime } from "./post-meta";
import { siteContent } from "@/lib/site-content";
import { Band } from "@/components/layout/band";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterChip } from "@/components/ui/filter-chip";
import { Skeleton } from "@/components/ui/skeleton";

const formatDate = formatPostDate;

/**
 * One post as a ruled row: date and read time in the margin, then the
 * title, the excerpt and the topics. The whole row is the link.
 *
 * Rows replaced a lead card and a grid of cover cards. Posts here mostly have
 * no cover, and the grid painted the title's first letter in a tinted box
 * instead, a placeholder; a date on
 * every row is also the quickest proof the writing is current.
 */
function PostRow({ post, href }: { post: BlogPost; href: string }) {
  // Prerendered: UTC until hydrated, so the build and the browser agree.
  const timeZone = useDisplayTimeZone();
  const topics = (post.tags ?? []).filter((t) => t.trim()).slice(0, 3);
  return (
    <li className="border-t border-border">
      <Link
        href={href}
        className="group grid gap-x-8 gap-y-1 rounded-control py-6 focus-ring lg:grid-cols-[12rem_minmax(0,1fr)]"
      >
        <p className="font-mono text-micro text-muted-foreground lg:pt-1">
          {post.published_at && (
            <time dateTime={post.published_at}>
              {formatDate(post.published_at, timeZone)}
            </time>
          )}
          {post.published_at && <span aria-hidden> · </span>}
          {readTime(post)} min read
          {typeof post.views === "number" && (
            <span className="ml-2 inline-flex items-center gap-1 lg:ml-0 lg:mt-1 lg:flex">
              <Eye className="size-3.5" aria-hidden />
              <span className="sr-only">Views:</span>
              {post.views.toLocaleString("en-US")}
            </span>
          )}
        </p>
        <div className="min-w-0 max-w-prose">
          <h2 className="font-heading text-xl font-semibold leading-snug underline-offset-4 decoration-primary decoration-2 [overflow-wrap:anywhere] group-hover:underline sm:text-2xl">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="mt-2 line-clamp-3 text-base leading-relaxed text-muted-foreground">
              {post.excerpt}
            </p>
          )}
          {topics.length > 0 && (
            <p className="mt-3 font-mono text-micro text-muted-foreground">
              {topics.join(" · ")}
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

/**
 * Reads the initial ?tag= filter. On its own, inside its own Suspense
 * boundary: under static export, useSearchParams opts its whole Suspense
 * subtree out of prerendering, and that subtree used to be the entire list —
 * so the page shipped with no posts in its HTML.
 */
function InitialTagFromUrl({ onTag }: { onTag: (tag: string) => void }) {
  const searchParams = useSearchParams();
  const initial = searchParams?.get("tag");
  useEffect(() => {
    if (initial) onTag(initial);
  }, [initial, onTag]);
  return null;
}

export function BlogListPage({
  builtSlugs,
}: {
  /** Slugs prerendered at the last build; see postHref. */
  builtSlugs?: readonly string[];
} = {}) {
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
    <Band weight="content">
      <Suspense fallback={null}>
        <InitialTagFromUrl onTag={setTag} />
      </Suspense>
      <PageHeader
        kicker="Writing"
        title={siteContent.pages.blog.title}
        subheading={siteContent.pages.blog.description}
      />

      <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
          <FilterBar label="Filter by topic">
            <FilterChip active={tag === null} onClick={() => setTag(null)}>
              All
            </FilterChip>
            {tags.map(({ tag: name, count }) => (
              <FilterChip
                key={name}
                active={tag === name}
                count={count}
                onClick={() => setTag(tag === name ? null : name)}
              >
                {name}
              </FilterChip>
            ))}
          </FilterBar>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-6" aria-busy>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-control" />
          ))}
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="rounded-surface bg-card px-6 py-14 text-center shadow-e1"
        >
          <p className="font-heading text-lg font-semibold">
            The posts didn&apos;t load
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing is lost — it&apos;s the connection, not the writing.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-surface border border-dashed px-6 py-16 text-center">
          <p className="font-heading text-lg font-semibold">
            {filtering ? "No posts match" : "Nothing published yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtering
              ? "Try a different word or topic."
              : "The first post is on its way."}
          </p>
          {filtering && (
            <Button variant="outline" className="mt-6 gap-2" onClick={clear}>
              <X className="size-4" aria-hidden />
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <ul className="border-b border-border">
          {filtered.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              href={postHref(post.slug, builtSlugs)}
            />
          ))}
        </ul>
      )}
    </Band>
  );
}
