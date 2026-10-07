"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { skipToken } from "@reduxjs/toolkit/query";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { useGetCaseStudyBySlugQuery } from "@/store/api/publicApi";
import { Band } from "@/components/layout/band";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { safeImageUrl } from "@/lib/safe-url";
import { plainPreview } from "@/lib/text-preview";
import { loadPostContent } from "@/features/blog/post-content-loader";
import { ContactCta } from "@/features/home/contact-cta";
import {
  ItemDates,
  ItemImage,
  ItemTags,
  TextLink,
  isLinkable,
} from "@/features/sections/shared";

// The blog's markdown pipeline: the same sanitiser, the same code
// highlighting, split into its own chunk and still rendered at build.
const PostContent = dynamic(
  () => loadPostContent().then((mod) => mod.PostContent),
  {
    loading: () => (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    ),
  },
);

const BACK_LINK =
  "group inline-flex items-center gap-1.5 rounded-control text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-ring";

function CaseStudyNotFound() {
  return (
    <Band weight="feature">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <p className="t-eyebrow">Case study not found</p>
        <h1 className="t-title mt-4 text-balance">
          This case study doesn&apos;t exist.
        </h1>
        <p className="t-lead mt-4 text-pretty">
          It may have been taken down, or the link may be mistyped.
        </p>
        <Button asChild size="lg" className="mt-10">
          <Link href="/work/">
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            All work
          </Link>
        </Button>
      </div>
    </Band>
  );
}

/**
 * One piece of work, told in full: what it was, the facts at a
 * glance, the write-up, then the way to start a conversation about it.
 */
export function CaseStudyPage({ slug }: { slug: string }) {
  const {
    data: study,
    isLoading,
    isError,
  } = useGetCaseStudyBySlugQuery(slug || skipToken);

  useEffect(() => {
    void loadPostContent();
  }, []);

  // Static-export limitation: the document title is set client-side on
  // /work/view/; the prerendered pages have theirs in the HTML.
  useEffect(() => {
    if (study) document.title = study.title;
  }, [study]);

  if (!slug || isError) return <CaseStudyNotFound />;

  if (isLoading || !study) {
    return (
      <Band weight="content" width="prose" aria-busy>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-8 h-14 w-3/4" />
        <Skeleton className="mt-6 h-5 w-56" />
        <Skeleton className="mt-10 h-72 w-full rounded-surface" />
      </Band>
    );
  }

  const summary = study.description ? plainPreview(study.description) : "";
  const hasDates = !!(study.date_from?.trim() || study.date_to?.trim());
  const tags = (study.tags ?? []).filter((tag) => tag.trim());
  const linked = isLinkable(study.link_url);

  const hasFacts = hasDates || tags.length > 0 || linked;
  /**
   * The facts: when, the stack, the project. In the margin rail from lg, the
   * case study template's "facts rail" (information-architecture.md §4);
   * under the title, ruled, on smaller screens. Rendered in one place at a
   * time, so a screen reader meets it once.
   */
  const facts = (className: string) => (
    <dl className={className}>
      {hasDates && (
        <div>
          <dt className="t-micro">When</dt>
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
          <dt className="t-micro">Stack</dt>
          <dd className="mt-1.5">
            <ItemTags tags={tags} max={12} />
          </dd>
        </div>
      )}
      {linked && (
        <div>
          <dt className="t-micro">Project</dt>
          <dd className="mt-1.5">
            <TextLink
              href={study.link_url}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              View the project
              <ArrowUpRight aria-hidden className="size-4" />
            </TextLink>
          </dd>
        </div>
      )}
    </dl>
  );

  return (
    <>
      <Band weight="content">
        <div className="grid gap-x-12 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <div className="hidden lg:block">
            {hasFacts && facts("sticky top-24 space-y-6 pt-24")}
          </div>
          <article className="min-w-0 max-w-prose">
            <header>
              <Link href="/work/" className={BACK_LINK}>
                <ArrowLeft
                  className="size-4 transition-transform duration-fast group-hover:-translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
                All work
              </Link>

              <p className="t-eyebrow mt-10">
                {study.subtitle?.trim() || "Case study"}
              </p>
              <h1 className="t-title mt-3 text-balance [overflow-wrap:anywhere]">
                {study.title}
              </h1>
              {summary && <p className="t-lead mt-5 text-pretty">{summary}</p>}

              {hasFacts && (
                <div className="lg:hidden">
                  {facts(
                    "mt-8 grid gap-6 border-y border-border py-6 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-10",
                  )}
                </div>
              )}

              {safeImageUrl(study.image_url) && (
                <ItemImage
                  src={study.image_url}
                  alt=""
                  className="mt-10 aspect-[21/9] w-full rounded-surface object-cover"
                />
              )}
            </header>

            <div className="mt-12">
              <PostContent content={study.case_study} />
            </div>
          </article>
        </div>
      </Band>
      <ContactCta />
    </>
  );
}
