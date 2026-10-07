"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetCaseStudyBySlugQuery,
  useGetSectionsByPathQuery,
} from "@/store/api/publicApi";
import { useBuiltCaseStudySlugs } from "@/store/public-preload";
import { CaseStudyPage } from "@/features/work/case-study-page";
import { caseStudyHref } from "@/features/work/case-study-href";
import { loadPostContent } from "@/features/blog/post-content-loader";
import {
  ItemDates,
  ItemTags,
  TextLink,
  isLinkable,
} from "@/features/sections/shared";
import { plainPreview } from "@/lib/text-preview";
import { isImmersive } from "@/lib/site-style";
import { useSiteStyle } from "../styles/use-site-style";
import { ImmersiveScroll, useScene } from "../motion/scroll-provider";
import { handoffScene, progressScene, settleScene } from "../shared/ruled";
import { allItems } from "../work/work-model";
import { nextCaseStudy } from "./case-study-model";

const PostContent = dynamic(() =>
  loadPostContent().then((mod) => mod.PostContent),
);

function Body({ slug }: { slug: string }) {
  const { data: study } = useGetCaseStudyBySlugQuery(slug || skipToken);
  const { data: sections } = useGetSectionsByPathQuery("/work");
  const built = useBuiltCaseStudySlugs();
  const titleRef = useRef<HTMLElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLElement>(null);
  useScene(titleRef, settleScene);
  useScene(readRef, progressScene);
  useScene(nextRef, handoffScene);

  if (!study) return null;

  const summary = study.description ? plainPreview(study.description) : "";
  const hasDates = Boolean(study.date_from?.trim() || study.date_to?.trim());
  const tags = (study.tags ?? []).filter((tag) => tag.trim());
  const linked = isLinkable(study.link_url);
  const next = nextCaseStudy(allItems(sections), study.slug);
  const nextTags = (next?.tags ?? []).filter((tag) => tag.trim());

  return (
    <>
      <header
        ref={titleRef}
        data-part="title"
        className="flex min-h-[calc(100svh-3.5rem)] flex-col justify-between gap-10 overflow-hidden px-[var(--band-x)] pb-8 pt-10 max-[399px]:px-4"
      >
        <p className="im-mono flex justify-between gap-4">
          <Link
            href="/work/"
            className="inline-flex min-h-6 items-center rounded-control text-foreground underline decoration-primary underline-offset-4 focus-ring"
          >
            All work
          </Link>
          <span>{study.subtitle?.trim() || "Case study"}</span>
        </p>
        <h1
          data-title
          className="im-display im-display-xl will-change-transform"
        >
          {study.title}
        </h1>
        <p className="im-mono min-h-6">{tags.join(" · ")}</p>
      </header>

      <div ref={readRef} data-part="reading" className="im-rule relative">
        {/* Decoration: the same information is the scrollbar. Hidden without motion. */}
        <div
          aria-hidden
          data-progress
          className="sticky top-14 z-10 h-0.5 origin-left scale-x-0 bg-primary motion-reduce:hidden"
        />
        <div className="grid gap-x-12 px-[var(--band-x)] py-16 max-[399px]:px-4 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <dl className="mb-10 grid gap-6 border-b border-border pb-8 sm:grid-cols-3 lg:sticky lg:top-24 lg:mb-0 lg:block lg:space-y-6 lg:self-start lg:border-0 lg:pb-0">
            {hasDates && (
              <div>
                <dt className="im-mono">When</dt>
                <dd className="mt-1.5">
                  <ItemDates
                    from={study.date_from}
                    to={study.date_to}
                    className="text-sm text-foreground"
                  />
                </dd>
              </div>
            )}
            {tags.length > 0 && (
              <div className="min-w-0">
                <dt className="im-mono">Stack</dt>
                <dd className="mt-1.5">
                  <ItemTags tags={tags} max={12} />
                </dd>
              </div>
            )}
            {linked && (
              <div>
                <dt className="im-mono">Project</dt>
                <dd className="mt-1.5">
                  <TextLink
                    href={study.link_url}
                    className="rounded-control text-sm font-semibold text-foreground underline decoration-primary underline-offset-4 focus-ring"
                  >
                    View the project
                  </TextLink>
                </dd>
              </div>
            )}
          </dl>
          {/* The reading column: no scroll effects here, by rule. */}
          <article className="min-w-0 max-w-prose">
            {summary && <p className="t-lead text-pretty">{summary}</p>}
            <div className="mt-10">
              <PostContent content={study.case_study} />
            </div>
          </article>
        </div>
      </div>

      {next && (
        <section
          ref={nextRef}
          data-part="handoff"
          aria-label="Next project"
          className="im-rule flex min-h-[90svh] flex-col justify-between gap-10 overflow-hidden px-[var(--band-x)] py-10 max-[399px]:px-4"
        >
          <p aria-hidden className="im-mono">
            Next project
          </p>
          <h2
            data-next
            className="im-display im-display-xl will-change-transform"
          >
            <Link
              href={caseStudyHref(next.slug!, built)}
              className="rounded-control decoration-primary decoration-4 underline-offset-[0.12em] hover:underline focus-ring"
            >
              {next.title}
            </Link>
          </h2>
          <p className="im-mono min-h-6">{nextTags.join(" · ")}</p>
        </section>
      )}
    </>
  );
}

/**
 * A case study in an immersive style: the title card, the reading layout with
 * the facts alongside, and the hand-off to the next project.
 *
 * Loading and not-found are the Classic page's own states (restyled by the
 * scope like any simple page), so there is one copy of those words.
 */
export default function ImmersiveCaseStudy({ slug }: { slug: string }) {
  const style = useSiteStyle();
  const { data: study, isError } = useGetCaseStudyBySlugQuery(
    slug || skipToken,
  );

  useEffect(() => {
    void loadPostContent();
  }, []);
  useEffect(() => {
    if (study) document.title = study.title;
  }, [study]);

  if (!slug || isError || !study) return <CaseStudyPage slug={slug} />;

  return isImmersive(style) ? (
    <ImmersiveScroll style={style}>
      <Body slug={slug} />
    </ImmersiveScroll>
  ) : (
    <Body slug={slug} />
  );
}
