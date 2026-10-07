"use client";

import { useRef } from "react";
import Link from "next/link";
import type { BlogPost } from "@/types";
import { useDisplayTimeZone } from "@/hooks/use-hydrated";
import { formatPostDate } from "@/features/blog/post-meta";
import { postHref } from "@/features/blog/post-href";
import { useScene } from "../motion/scroll-provider";
import { Rule, ruleScene } from "../shared/ruled";
import { WRITING_MAX } from "./home-model";

/** Beat 6: the newest posts as a ruled list of large titles. */
export function Writing({
  posts,
  builtSlugs,
}: {
  posts: readonly BlogPost[];
  builtSlugs?: readonly string[];
}) {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, ruleScene);
  // Prerendered: UTC until hydrated, so the build and the browser agree.
  const timeZone = useDisplayTimeZone();

  return (
    <section
      ref={ref}
      data-beat="writing"
      aria-labelledby="im-writing-heading"
      className="px-[var(--band-x)] py-20 max-[399px]:px-4 md:py-32"
    >
      <div className="flex items-baseline justify-between gap-6">
        <h2 id="im-writing-heading" className="im-mono">
          Writing
        </h2>
        <Link
          href="/blog/"
          className="im-mono inline-flex min-h-6 items-center rounded-control text-foreground underline decoration-primary underline-offset-4 focus-ring"
        >
          All writing
        </Link>
      </div>
      <ul className="mt-8">
        {posts.slice(0, WRITING_MAX).map((post) => (
          <li key={post.slug}>
            <Rule />
            <div className="flex flex-col gap-2 py-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8">
              <h3 className="im-display im-display-md min-w-0 !normal-case">
                <Link
                  href={postHref(post.slug, builtSlugs)}
                  className="rounded-control decoration-primary decoration-2 underline-offset-[0.15em] hover:underline focus-ring"
                >
                  {post.title}
                </Link>
              </h3>
              {post.published_at && (
                <time dateTime={post.published_at} className="im-mono shrink-0">
                  {formatPostDate(post.published_at, timeZone)}
                </time>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
