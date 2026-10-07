import type { SiteContent } from "@/types";
import { BUCKET_NAME } from "@/lib/constants";
import { DEFAULT_THEME } from "@/lib/themes";

/**
 * What a new owner has left to do before their site is theirs.
 *
 * Derived from what is actually in the database rather than from boxes the
 * owner ticks — a checklist that trusts the user to say "done" is a list of
 * reminders, and it goes stale the first time one is ticked by accident.
 */

export interface SetupInputs {
  identity?: SiteContent;
  sectionCount: number;
  publishedPostCount: number;
  /** "unknown" when it could not be checked — then it is not nagged about. */
  storage: "ok" | "missing" | "unknown";
}

export interface SetupItem {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
}

/**
 * What `db/schema.sql` seeds, which is placeholder text rather than an answer.
 *
 * A fresh install arrives with "Your Name", "Your Professional Title",
 * `github.com/your-username` and the default theme already in the row. Read
 * naively, three steps tick themselves on day one — while the live site still
 * says "Your Name" to every visitor, which is exactly what the checklist
 * exists to prevent.
 */
const SEEDED_NAME = "your name";
const SEEDED_TITLE = "your professional title";
/** What older installs were seeded with; it is not a choice either. */
const LEGACY_SEEDED_THEME = "theme-blueprint";
const SEEDED_URL = /your-username|your-profile|your-email@example\.com/i;

function answered(value: string | undefined, seeded: string): boolean {
  const text = (value ?? "").trim();
  return text !== "" && text.toLowerCase() !== seeded;
}

export function setupItems({
  identity,
  sectionCount,
  publishedPostCount,
  storage,
}: SetupInputs): SetupItem[] {
  const profile = identity?.profile_data;
  const hasLink = (identity?.social_links ?? []).some(
    (link) =>
      link.is_visible !== false &&
      link.url.trim() !== "" &&
      !SEEDED_URL.test(link.url),
  );

  return [
    {
      id: "profile",
      title: "Say who you are",
      description: "Your name, your role and a photo.",
      href: "/admin/settings",
      done:
        answered(profile?.name, SEEDED_NAME) &&
        answered(profile?.title, SEEDED_TITLE),
    },
    {
      id: "pitch",
      title: "Write your headline",
      description:
        "The one line a visitor should leave with — and your results.",
      href: "/admin/settings",
      done: !!profile?.headline?.trim(),
    },
    {
      id: "look",
      title: "Pick a look",
      description: "A theme and a type pairing that feel like you.",
      href: "/admin/settings",
      done:
        !!profile &&
        ((profile.default_theme !== DEFAULT_THEME &&
          profile.default_theme !== LEGACY_SEEDED_THEME &&
          !!profile.default_theme) ||
          (profile.typography_preset ?? "typo-default") !== "typo-default"),
    },
    {
      id: "links",
      title: "Add where people find you",
      description:
        "GitHub, LinkedIn, email — shown in the hero and the footer.",
      href: "/admin/settings",
      done: hasLink,
    },
    {
      id: "pages",
      title: "Fill your pages",
      description:
        "Services, case studies and experience, from ready-made sections.",
      href: "/admin/content",
      done: sectionCount > 0,
    },
    {
      id: "post",
      title: "Publish a first post",
      description: "Something you learned, built or shipped.",
      href: "/admin/blog",
      done: publishedPostCount > 0,
    },
    {
      id: "storage",
      title: "Create the image bucket",
      description: `A public Supabase storage bucket named “${BUCKET_NAME}”, for uploads.`,
      href: "/admin/assets",
      done: storage !== "missing",
    },
  ];
}
