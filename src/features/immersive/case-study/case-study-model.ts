import type { PortfolioItem } from "@/types";

/**
 * The project the end of a case study hands off to: the next one with a case
 * study, wrapping round. Null when there is no other, or when this case study
 * is not among the work sections (it is linked from nowhere to go on from).
 */
export function nextCaseStudy(
  items: readonly PortfolioItem[],
  slug: string,
): PortfolioItem | null {
  const studies = items.filter((item) => item.has_case_study && item.slug);
  const index = studies.findIndex((item) => item.slug === slug);
  if (index === -1 || studies.length < 2) return null;
  return studies[(index + 1) % studies.length];
}
