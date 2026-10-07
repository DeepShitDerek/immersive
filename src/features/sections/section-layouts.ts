import type { ComponentType } from "react";
import type { PortfolioItem } from "@/types";
import {
  CardsWithImageLayout,
  CompactCardsLayout,
  DefaultListLayout,
  FeatureAlternatingLayout,
  Grid2ColLayout,
  Grid3ColLayout,
  MasonryLayout,
  StatsGridLayout,
  TimelineLayout,
} from "./layouts-basic";
import {
  CaseStudyLayout,
  ImpactNumbersLayout,
  ServicesLayout,
  TestimonialsLayout,
  WorkExperienceLayout,
} from "./layouts-showcase";
import { FaqLayout, ProcessLayout } from "./layouts-sales";
import {
  ClientLogosLayout,
  NowPageLayout,
  OpenSourceLayout,
  PressAwardsLayout,
  SpeakingLayout,
  UsesLayout,
} from "./layouts-creative";

export type LayoutComponent = ComponentType<{ items: PortfolioItem[] }>;

/**
 * Single source of truth mapping `portfolio_sections.layout_style` to a
 * renderer.
 *
 * This replaces the old switch statement inside SectionRenderer. A map is
 * better here for three reasons:
 *
 *  1. `github-grid` is intentionally absent — it ignores `items` and takes no
 *     props, so it is special-cased in the renderer rather than forced into
 *     this signature.
 *  2. The admin registry can be diffed against `Object.keys(SECTION_LAYOUTS)`
 *     in a test, so adding a layout option without a renderer fails CI instead
 *     of silently falling back to a plain list on the live site.
 *  3. `isKnownLayout()` lets the admin flag a section whose layout_style does
 *     not exist — which is exactly the state the database allows, since the
 *     column is unconstrained TEXT with no lookup table.
 */
const SECTION_LAYOUTS: Record<string, LayoutComponent> = {
  // Basic
  default: DefaultListLayout,
  timeline: TimelineLayout,
  "grid-2-col": Grid2ColLayout,
  "grid-3-col": Grid3ColLayout,
  "cards-with-image": CardsWithImageLayout,
  "compact-cards": CompactCardsLayout,
  "stats-grid": StatsGridLayout,
  masonry: MasonryLayout,
  "feature-alternating": FeatureAlternatingLayout,
  // Must-haves
  "case-study": CaseStudyLayout,
  services: ServicesLayout,
  "work-experience": WorkExperienceLayout,
  testimonials: TestimonialsLayout,
  // High signal
  "impact-numbers": ImpactNumbersLayout,
  "open-source": OpenSourceLayout,
  speaking: SpeakingLayout,
  // Creative
  "press-awards": PressAwardsLayout,
  "client-logos": ClientLogosLayout,
  "now-page": NowPageLayout,
  uses: UsesLayout,
  // Selling
  process: ProcessLayout,
  faq: FaqLayout,
};

/** Layouts that render their own data source and ignore `portfolio_items`. */
/**
 * Layouts that render their own data source and ignore `portfolio_items`.
 * `highlight` reads one public Library line, chosen at random per visit.
 */
export const SELF_SOURCING_LAYOUTS = new Set(["github-grid", "highlight"]);

export function isKnownLayout(layout?: string | null): boolean {
  if (!layout) return false;
  return layout in SECTION_LAYOUTS || SELF_SOURCING_LAYOUTS.has(layout);
}

export function resolveLayout(layout?: string | null): LayoutComponent {
  return (layout && SECTION_LAYOUTS[layout]) || DefaultListLayout;
}
