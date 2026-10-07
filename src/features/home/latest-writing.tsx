"use client";

import Link from "next/link";
import { useGetPublishedBlogPostsQuery } from "@/store/api/publicApi";
import { Band, BandHeading } from "@/components/layout/band";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { formatPostDate, readTime } from "@/features/blog/post-meta";
import { postHref } from "@/features/blog/post-href";
import { SectionLink } from "./section-link";

const SHOWN = 3;

/**
 * The three newest posts as dated rows. Writing shows how someone
 * thinks, which a list of past roles can't, and a date on every row is the
 * cheapest proof that the site is alive.
 *
 * The date sits in the margin on wide screens, in the meta face, so the
 * titles share one left edge with Selected work above. Renders nothing until
 * there is something published.
 */
export function LatestWriting({
  builtSlugs,
}: {
  /** Slugs prerendered at the last build; see postHref. */
  builtSlugs?: readonly string[];
}) {
  const { data: posts } = useGetPublishedBlogPostsQuery();
  // Prerendered: UTC until hydrated, so the build and the browser agree.
  const timeZone = useDisplayTimeZone();
  const all = posts ?? [];
  const latest = all.slice(0, SHOWN);

  if (latest.length === 0) return null;

  return (
    <Band weight="content" aria-labelledby="latest-writing-heading">
      <BandHeading
        id="latest-writing-heading"
        eyebrow="Writing"
        title="Latest notes"
        actions={
          <SectionLink href="/blog/">All writing ({all.length})</SectionLink>
        }
      />
      <ul className="mt-8 border-b border-border">
        {latest.map((post) => (
          <li key={post.id} className="border-t border-border">
            <Link
              href={postHref(post.slug, builtSlugs)}
              className="group grid gap-x-8 gap-y-1 rounded-control py-5 focus-ring lg:grid-cols-[12rem_minmax(0,1fr)]"
            >
              <p className="font-mono text-micro text-muted-foreground lg:pt-1">
                {post.published_at && (
                  <time dateTime={post.published_at}>
                    {formatPostDate(post.published_at, timeZone)}
                  </time>
                )}
                {post.published_at && <span aria-hidden> · </span>}
                {readTime(post)} min read
              </p>
              <div className="min-w-0">
                <h3 className="font-heading text-lg font-semibold leading-snug underline-offset-4 decoration-primary decoration-2 [overflow-wrap:anywhere] group-hover:underline sm:text-xl">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="mt-1.5 line-clamp-2 max-w-prose text-base leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Band>
  );
}
