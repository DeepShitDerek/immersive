"use client";

import { useState } from "react";
import Link from "next/link";
import type { PortfolioItem } from "@/types";
import { useGetSectionsByPathQuery } from "@/store/api/publicApi";
import { useBuiltCaseStudySlugs } from "@/store/public-preload";
import { caseStudyHref } from "@/features/work/case-study-href";
import { ItemImage } from "@/features/sections/shared";
import { useRepoList } from "@/features/github/use-repo-list";
import { isInternalUrl, safeImageUrl, safeLinkUrl } from "@/lib/safe-url";
import { siteContent } from "@/lib/site-content";
import { cn } from "@/lib/cn";
import { ProjectPattern } from "../pattern/project-pattern";
import { Chip, WithScroll } from "../shared/ruled";
import { allItems, allTags, filterByTag, resolveTag } from "./work-model";
import { useQueryParam } from "./use-query-param";
import { RepoList } from "./repo-list";

const two = (n: number) => String(n).padStart(2, "0");

const TITLE_LINK =
  "rounded-control decoration-primary decoration-2 underline-offset-[0.15em] hover:underline focus-ring";

function Preview({
  item,
  className,
}: {
  item: PortfolioItem;
  className?: string;
}) {
  return safeImageUrl(item.image_url) ? (
    <ItemImage
      src={item.image_url}
      alt=""
      className={cn("object-cover", className)}
    />
  ) : (
    <ProjectPattern
      title={item.title}
      tags={item.tags}
      className={cn("text-muted-foreground", className)}
    />
  );
}

/**
 * /work in an immersive style: every project as a ruled list of large titles.
 *
 * With a fine pointer on a wide screen the pointed-at (or focused) project's
 * preview sits beside the list; otherwise each row carries its own. The tag
 * filter lives in the URL, so a filtered list can be shared.
 */
function Page() {
  const { data: sections } = useGetSectionsByPathQuery("/work");
  const built = useBuiltCaseStudySlugs();
  const [param, setParam] = useQueryParam("tag");
  const [activeId, setActiveId] = useState<string | null>(null);
  // The heading below belongs to the list: no list, no heading.
  const { state: repoState } = useRepoList();

  const items = allItems(sections);
  const tags = allTags(items);
  const tag = resolveTag(param, tags);
  const shown = filterByTag(items, tag);
  const active = shown.find((item) => item.id === activeId) ?? shown[0];

  const filter = (label: string, value: string | null) => (
    <li key={label}>
      <Chip active={tag === value} onClick={() => setParam(value)}>
        {label}
      </Chip>
    </li>
  );

  return (
    <>
      <section className="px-[var(--band-x)] pb-20 pt-12 max-[399px]:px-4 md:pt-20">
        <h1 className="im-display im-display-lg">
          {siteContent.pages.work.heading}
        </h1>
        {tags.length > 0 && (
          <ul aria-label="Filter by tag" className="mt-8 flex flex-wrap gap-2">
            {filter("All", null)}
            {tags.map((name) => filter(name, name))}
          </ul>
        )}

        <div className="mt-10 gap-x-12 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <ol>
            {shown.map((item, index) => {
              const link = safeLinkUrl(item.link_url);
              const visibleTags = (item.tags ?? []).filter((t) => t.trim());
              return (
                <li
                  key={item.id}
                  data-row
                  className="im-rule py-6"
                  onPointerEnter={() => setActiveId(item.id)}
                  onFocus={() => setActiveId(item.id)}
                >
                  <div className="flex items-baseline gap-4">
                    <span className="im-mono w-8 shrink-0">
                      {two(index + 1)}
                    </span>
                    <div className="min-w-0 grow">
                      <h2 className="im-display im-display-md">
                        {item.has_case_study && item.slug ? (
                          <Link
                            href={caseStudyHref(item.slug, built)}
                            className={TITLE_LINK}
                          >
                            {item.title}
                          </Link>
                        ) : link ? (
                          <a
                            href={link}
                            className={TITLE_LINK}
                            {...(isInternalUrl(link)
                              ? {}
                              : {
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                })}
                          >
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </h2>
                      {item.subtitle && (
                        <p className="mt-2 text-base text-muted-foreground">
                          {item.subtitle}
                        </p>
                      )}
                      {visibleTags.length > 0 && (
                        <p className="im-mono mt-3">
                          {visibleTags.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Where there is no side preview, each row carries its own. */}
                  <Preview
                    item={item}
                    className="mt-5 h-32 w-full rounded-surface border border-border [@media(pointer:fine)]:lg:hidden"
                  />
                </li>
              );
            })}
          </ol>

          {active && (
            <div aria-hidden className="hidden [@media(pointer:fine)]:lg:block">
              <div className="sticky top-20 aspect-[4/3] overflow-hidden rounded-surface border border-border">
                <Preview key={active.id} item={active} className="size-full" />
              </div>
            </div>
          )}
        </div>
      </section>

      {repoState !== "hidden" && (
        <section
          aria-labelledby="im-repos-heading"
          className="im-rule px-[var(--band-x)] py-20 max-[399px]:px-4"
        >
          <h2
            id="im-repos-heading"
            className="im-display im-display-md !normal-case"
          >
            Open source &amp; experiments
          </h2>
          <div className="mt-8">
            <RepoList />
          </div>
        </section>
      )}
    </>
  );
}

/** Under the scroll provider, for the repository list's rule draw. */
export default function ImmersiveWork() {
  return (
    <WithScroll>
      <Page />
    </WithScroll>
  );
}
