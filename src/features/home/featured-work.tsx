"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useGetSectionsByPathQuery } from "@/store/api/publicApi";
import { Band, BandHeading } from "@/components/layout/band";
import { sortedItems } from "@/features/sections/shared";
import { plainPreview } from "@/lib/text-preview";
import { useBuiltCaseStudySlugs } from "@/store/public-preload";
import { caseStudyHref } from "@/features/work/case-study-href";
import { SectionLink } from "./section-link";

const SHOWN = 3;
const STACK_SHOWN = 4;

/** "RAG · PGVector · Python +2": the stack as one line of meta. */
export function stackLine(tags?: string[] | null): string {
  const clean = Array.from(
    new Set((tags ?? []).map((t) => t?.trim()).filter(Boolean)),
  );
  const shown = clean.slice(0, STACK_SHOWN).join(" · ");
  const more = clean.length - STACK_SHOWN;
  return more > 0 ? `${shown} +${more}` : shown;
}

/** The when and where of a row, for the margin. */
function railText(
  subtitle?: string | null,
  from?: string | null,
  to?: string | null,
) {
  const start = from?.trim();
  const end = to?.trim();
  const when = start
    ? `${start} — ${end || "Present"}`
    : end
      ? `Until ${end}`
      : "";
  return [subtitle?.trim(), when].filter(Boolean);
}

/**
 * The first three pieces of work, as ruled rows.
 *
 * Rows, not cards: a row reads top to bottom like a list of results, and
 * there is no image box to fill — the old cards drew a letter tile when a
 * project had no picture, the most unfinished-looking thing on the page.
 * The margin carries where and when; the row is one link, to the case study
 * when one is written and to /work otherwise, with no second
 * "View project" button inside it.
 *
 * Reads the /work sections, case studies first as ordered in Content, so the
 * home page shows proof without the owner curating a second copy. Renders
 * nothing when there is no work to show, rather than an empty band.
 */
export function FeaturedWork() {
  const { data: sections } = useGetSectionsByPathQuery("/work");
  const built = useBuiltCaseStudySlugs();
  const items = (sections ?? [])
    .flatMap((section) => sortedItems(section.portfolio_items))
    .slice(0, SHOWN);

  if (items.length === 0) return null;

  return (
    <Band weight="content" aria-labelledby="featured-work-heading">
      <BandHeading
        id="featured-work-heading"
        eyebrow="Selected work"
        title="Systems that shipped"
        actions={<SectionLink href="/work/">All work</SectionLink>}
      />
      <ul className="mt-8 border-b border-border">
        {items.map((item) => {
          const caseStudy = Boolean(item.has_case_study && item.slug);
          const rail = railText(item.subtitle, item.date_from, item.date_to);
          const stack = stackLine(item.tags);
          return (
            <li key={item.id} className="border-t border-border">
              <Link
                href={caseStudy ? caseStudyHref(item.slug!, built) : "/work/"}
                className="group grid gap-x-8 gap-y-2 rounded-control py-6 focus-ring lg:grid-cols-[12rem_minmax(0,1fr)_auto]"
              >
                {rail.length > 0 ? (
                  <p className="font-mono text-micro leading-relaxed text-muted-foreground lg:pt-1.5">
                    {rail.map((line, index) => (
                      <span
                        key={index}
                        className="mr-3 inline-block lg:mr-0 lg:block"
                      >
                        {line}
                      </span>
                    ))}
                  </p>
                ) : (
                  <span aria-hidden className="hidden lg:block" />
                )}
                <div className="min-w-0">
                  <h3 className="t-heading underline-offset-4 decoration-primary decoration-2 [overflow-wrap:anywhere] group-hover:underline">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="mt-2 line-clamp-2 max-w-prose text-base leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                      {plainPreview(item.description)}
                    </p>
                  )}
                  {stack && (
                    <p className="mt-3 font-mono text-micro text-muted-foreground">
                      {stack}
                    </p>
                  )}
                </div>
                <span className="hidden items-start gap-1.5 pt-1.5 text-sm font-semibold text-primary lg:flex">
                  {caseStudy ? "Read the case study" : "See it on Work"}
                  <ArrowRight
                    aria-hidden
                    className="mt-0.5 size-4 transition-transform duration-fast group-hover:translate-x-0.5 motion-reduce:transition-none"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Band>
  );
}
