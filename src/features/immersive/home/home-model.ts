import type {
  BlogPost,
  PortfolioItem,
  PortfolioSection,
  SiteContent,
} from "@/types";
import { sortedItems } from "@/features/sections/shared";
import { safeLinkUrl } from "@/lib/safe-url";

export type BeatId =
  | "opening"
  | "statement"
  | "proof"
  | "work"
  | "now"
  | "writing"
  | "closing";

export const FEATURED_MAX = 6;
export const WRITING_MAX = 3;

/** The projects the home page walks through: the first few on /work. */
export function featuredItems(
  sections: readonly PortfolioSection[] | undefined,
): PortfolioItem[] {
  return (sections ?? [])
    .flatMap((section) => sortedItems(section.portfolio_items))
    .slice(0, FEATURED_MAX);
}

/** The headline, or the first bio paragraph standing in for it. */
export function statementOf(identity: SiteContent): {
  headline: string;
  bio: string[];
} {
  const headline = identity.profile_data.headline?.trim() ?? "";
  const bio = (identity.profile_data.bio ?? []).filter((p) => p.trim());
  if (headline) return { headline, bio };
  return { headline: bio[0] ?? "", bio: bio.slice(1) };
}

/** The owner's visible email as a safe href, or null. Same rule as ContactCta. */
export function emailOf(identity: SiteContent): string | null {
  const email = identity.social_links.find(
    (social) => social.id.toLowerCase() === "email" && social.is_visible,
  );
  return (email && safeLinkUrl(email.url)) || null;
}

/**
 * Whether the status panel has anything to say. It is on by default with a
 * title and nothing else, and a panel holding only its own heading is an
 * empty section, not a beat.
 */
export function hasStatus(
  status: SiteContent["profile_data"]["status_panel"] | undefined,
): boolean {
  if (!status?.show) return false;
  const exploring = (status.currently_exploring?.items ?? []).some((entry) =>
    entry.trim(),
  );
  const latest = Boolean(
    status.latestProject?.name?.trim() &&
      safeLinkUrl(status.latestProject.href),
  );
  return Boolean(status.availability?.trim()) || exploring || latest;
}

/**
 * The beats to render, in order. A beat with nothing to show is left out, not
 * padded: a site with only a name is the opening and the closing.
 */
export function homeBeats(input: {
  identity: SiteContent;
  featured: readonly PortfolioItem[];
  posts: readonly BlogPost[];
}): BeatId[] {
  const { identity, featured, posts } = input;
  const profile = identity.profile_data;
  const beats: BeatId[] = ["opening"];
  if (statementOf(identity).headline) beats.push("statement");
  if ((profile.proof ?? []).length > 0) beats.push("proof");
  if (featured.length > 0) beats.push("work");
  if (hasStatus(profile.status_panel)) beats.push("now");
  if (posts.length > 0) beats.push("writing");
  beats.push("closing");
  return beats;
}

export function words(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}
