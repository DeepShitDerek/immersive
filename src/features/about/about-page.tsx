"use client";

import { useGetSiteIdentityQuery } from "@/store/api/publicApi";
import { cn } from "@/lib/cn";
import { Markdown } from "@/components/ui/markdown";
import { Band } from "@/components/layout/band";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import { Reveal, Stagger, StaggerItem } from "@/components/layout/motion";
import { safeImageUrl } from "@/lib/safe-url";
import { sizedImageUrl } from "@/lib/image-size";
import type { SiteContent } from "@/types";
import { StatusPanel } from "@/features/home/status-panel";

export function AboutPage() {
  const { data: identity, isLoading } = useGetSiteIdentityQuery();

  return (
    <Band weight="content">
      {/* "whoami" was the v2 terminal voice. */}
      <PageHeader kicker="About" title="About me" />

      {isLoading || !identity ? (
        <div className="grid gap-10 sm:grid-cols-[15rem_1fr]" aria-busy>
          <Skeleton className="aspect-[4/5] w-full rounded-surface" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ) : (
        <AboutView identity={identity} />
      )}

      <div className="mt-24">
        <DynamicPageContent pagePath="/about" />
      </div>
    </Band>
  );
}

/**
 * Picture and bio, over identity passed in rather than fetched — the part of
 * this page the settings screen controls, so the settings preview can render
 * the real thing instead of a lookalike. The CMS block below it is left to the
 * page: it has its own query and nothing in settings changes it.
 */
export function AboutView({ identity }: { identity: SiteContent }) {
  /**
   * The picture column exists only when there is a picture.
   *
   * The grid was unconditional, so with the picture switched off the bio still
   * rendered into the *second* column and the 8rem first column stayed as an
   * empty gutter — the text started a third of the way across the page for no
   * reason a reader could see. With no picture the prose simply takes the
   * band at its own reading measure, which is the layout an about page wants
   * anyway.
   */
  const { profile_data } = identity;
  // Through the image allowlist: the URL is owner-entered TEXT rendered on a
  // public page, and a `javascript:` or `data:` value must not reach `src`.
  const picture = profile_data.show_profile_picture
    ? safeImageUrl(profile_data.profile_picture_url)
    : null;
  const showPicture = Boolean(picture);
  const role = profile_data.title?.split("|")[0]?.trim();
  const [lead, ...rest] = profile_data.bio.filter((p) => p?.trim());

  /**
   * An editorial spread: the portrait as a card that stays beside the bio on
   * a wide screen, and the bio opening on a larger first paragraph — the
   * magazine convention for "start reading here".
   */
  return (
    <div
      className={cn(
        "grid gap-10 lg:gap-16",
        showPicture &&
          "sm:grid-cols-[11rem_minmax(0,1fr)] lg:grid-cols-[14rem_minmax(0,1fr)]",
      )}
    >
      {showPicture && (
        <Reveal className="min-w-0 sm:sticky sm:top-28 sm:self-start">
          {/*
            On a phone the portrait was the full width at 4:5 — taller than the
            screen, above a single paragraph. There it is an avatar beside the
            name; from `sm` up it becomes a narrow portrait card in its own
            column, never wider than 14rem.
          */}
          <figure className="flex items-center gap-4 sm:block sm:overflow-hidden sm:rounded-surface sm:border sm:border-border sm:bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              // Never wider than 14rem (224px) in its column.
              src={sizedImageUrl(picture as string, 224)}
              alt={profile_data.name}
              className="size-20 shrink-0 rounded-full object-cover sm:aspect-[4/5] sm:size-auto sm:w-full sm:rounded-none"
            />
            <figcaption className="min-w-0 sm:p-4">
              <p className="font-heading font-semibold [overflow-wrap:anywhere]">
                {profile_data.name}
              </p>
              {role && (
                <p className="mt-0.5 text-sm text-muted-foreground">{role}</p>
              )}
            </figcaption>
          </figure>
        </Reveal>
      )}
      <Stagger className="min-w-0 max-w-prose space-y-5 [&_strong]:text-foreground">
        {lead && (
          <StaggerItem>
            <Markdown className="max-w-none text-lg leading-relaxed text-foreground sm:text-xl [&_p]:m-0">
              {lead}
            </Markdown>
          </StaggerItem>
        )}
        {rest.map((paragraph, index) => (
          <StaggerItem key={index}>
            <Markdown className="max-w-none leading-relaxed text-muted-foreground">
              {paragraph}
            </Markdown>
          </StaggerItem>
        ))}
        {/* What the owner is working on and learning. It is here and not on the
            home page: a buyer needs strengths first, and a
            reader of this page is the one who asked "who is this?". */}
        {profile_data.status_panel?.show && (
          <section aria-labelledby="about-now" className="pt-6">
            <h2 id="about-now" className="t-heading mb-4">
              Now
            </h2>
            <StatusPanel panel={profile_data.status_panel} />
          </section>
        )}
      </Stagger>
    </div>
  );
}
