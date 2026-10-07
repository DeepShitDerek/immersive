"use client";

import { Band } from "@/components/layout/band";
import { DynamicPageContent } from "@/features/sections/dynamic-page-content";
import { ContactCta } from "./contact-cta";
import { FeaturedWork } from "./featured-work";
import { Hero } from "./hero";
import { LatestWriting } from "./latest-writing";
import { RouteLinks } from "./route-links";

/**
 * Home, in the order a visitor needs it (information-architecture.md §3):
 * the promise and its proof, where to go next, the work, the owner's own
 * sections ("How I work" lives there), the writing, and the ask again.
 *
 * Rows and rules, not a stack of cards; each band is one topic, and the
 * route links join the hero at the tight rhythm because they answer it.
 */
export function HomePage({
  builtSlugs,
}: {
  /** Slugs prerendered at the last build, for Latest writing's links. */
  builtSlugs?: readonly string[];
} = {}) {
  return (
    <>
      <Hero />
      <RouteLinks />
      <FeaturedWork />
      <Band weight="content">
        <DynamicPageContent pagePath="/" />
      </Band>
      <LatestWriting builtSlugs={builtSlugs} />
      <ContactCta />
    </>
  );
}
