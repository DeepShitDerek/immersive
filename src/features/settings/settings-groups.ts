import {
  isImmersive,
  resolveSiteStyle,
  type SiteStyle,
} from "@/lib/site-style";
import {
  BookUser,
  Fingerprint,
  Footprints,
  Github,
  LayoutDashboard,
  Link as LinkIcon,
  MessageSquare,
  PanelRightOpen,
  Palette,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import type { FieldPath } from "./settings-payload";

/**
 * The single list of settings groups.
 *
 * One registry drives four things that used to be four hand-maintained lists:
 * the navigation rail, what the search box can find, which fields a group's
 * Save validates and writes, and which public page the preview shows. Adding a
 * setting means adding its path here; forgetting to is visible immediately,
 * because the field stops being saved rather than silently saving under
 * someone else's button.
 *
 * `PreviewPage` is deliberately narrow. The preview renders the real public
 * components for what settings actually controls — it is not a browser, and a
 * group with nothing visual to show (Layout, which changes route structure)
 * says so rather than displaying a page that will not change.
 */

export type PreviewPage = "home" | "about" | "contact";

export interface SettingsGroup {
  id: string;
  label: string;
  /** One line under the heading: what this group decides. */
  description: string;
  icon: LucideIcon;
  /** Everything this group's Save validates and writes. */
  fields: readonly FieldPath[];
  /** Which page the preview opens on when this group is selected. */
  preview: PreviewPage | null;
  /** Extra words the search box should match — synonyms, old labels. */
  keywords: readonly string[];
}

/**
 * The groups whose settings nothing reads in an immersive style: Noir, Paper
 * and Dusk bring their own colours and type, to the site and the workspace.
 */
const GOVERNED_BY_STYLE: readonly string[] = ["theme", "typography"];

/**
 * How a group behaves under the chosen site style. Under Classic, as it is
 * declared. Under an immersive style the public site and the workspace both
 * take their look from the style, so Theme and Typography are idle: they
 * stay editable (the choice comes back with Classic) and lose their preview,
 * which would show a site their values no longer reach.
 */
export function groupUnderStyle(
  group: Pick<SettingsGroup, "id" | "preview">,
  style: SiteStyle,
): { preview: SettingsGroup["preview"]; governed: boolean } {
  const governed =
    isImmersive(resolveSiteStyle(style)) &&
    GOVERNED_BY_STYLE.includes(group.id);
  return { preview: governed ? null : group.preview, governed };
}

export const SETTINGS_SECTIONS: readonly {
  id: string;
  label: string;
  groups: readonly SettingsGroup[];
}[] = [
  {
    id: "identity",
    label: "Identity",
    groups: [
      {
        id: "brand",
        label: "Brand & logo",
        description:
          "The name and mark that appear in the header, tab title and share cards.",
        icon: Fingerprint,
        fields: [
          "profile_data.name",
          "profile_data.logo",
          "profile_data.profile_picture_url",
          "profile_data.show_profile_picture",
        ],
        preview: "about",
        keywords: ["name", "logo", "avatar", "profile picture", "wordmark"],
      },
      {
        id: "hero",
        label: "Hero & bio",
        description:
          "The headline on the home page and the paragraphs on About.",
        icon: BookUser,
        fields: [
          "profile_data.headline",
          "profile_data.title",
          "profile_data.description",
          "profile_data.proof",
          "profile_data.bio",
        ],
        preview: "home",
        keywords: [
          "headline",
          "title",
          "role",
          "tagline",
          "about",
          "description",
          "intro",
          "results",
          "proof",
          "metrics",
        ],
      },
      {
        id: "social",
        label: "Social links",
        description:
          "Where people find you. Shown under the hero and on the contact page.",
        icon: LinkIcon,
        fields: ["social_links"],
        preview: "contact",
        keywords: ["github", "linkedin", "email", "twitter", "mastodon", "url"],
      },
    ],
  },
  {
    id: "appearance",
    label: "Appearance",
    groups: [
      {
        id: "theme",
        label: "Theme",
        description:
          "52 presets, all gated at WCAG AA — or six colours of your own.",
        icon: Palette,
        fields: [
          "profile_data.default_theme",
          "profile_data.custom_theme_colors",
        ],
        preview: "home",
        keywords: ["colour", "color", "dark mode", "palette", "custom", "hex"],
      },
      {
        id: "typography",
        label: "Typography",
        description: "The font pairing every page is set in.",
        icon: Type,
        fields: ["profile_data.typography_preset"],
        preview: "home",
        keywords: ["font", "typeface", "serif", "heading", "body"],
      },
      {
        id: "site-style",
        label: "Site style",
        description:
          "Classic, or one of three immersive looks for the public site.",
        icon: Sparkles,
        fields: ["profile_data.site_style"],
        preview: "home",
        keywords: [
          "immersive",
          "noir",
          "paper",
          "dusk",
          "cinematic",
          "scroll",
          "style",
        ],
      },
      {
        id: "layout",
        label: "Layout",
        description:
          "Route structure and how the updates feed is arranged. Not previewable here.",
        icon: LayoutDashboard,
        fields: ["portfolio_mode", "profile_data.updates_layout"],
        preview: null,
        keywords: [
          "single page",
          "multi page",
          "updates",
          "timeline",
          "scrapbook",
        ],
      },
    ],
  },
  {
    id: "pages",
    label: "Pages",
    groups: [
      {
        id: "status",
        label: "Status panel",
        description:
          "The card beside the hero: availability, what you are exploring, latest project.",
        icon: PanelRightOpen,
        fields: ["profile_data.status_panel"],
        preview: "home",
        keywords: ["availability", "exploring", "latest project", "hud", "now"],
      },
      {
        id: "github",
        label: "GitHub",
        description: "Which repositories the projects page pulls and shows.",
        icon: Github,
        fields: ["profile_data.github_projects_config"],
        preview: null,
        keywords: ["repos", "repositories", "stars", "forks", "projects"],
      },
      {
        id: "contact",
        label: "Contact page",
        description: "Which blocks the contact page renders.",
        icon: MessageSquare,
        fields: ["profile_data.contact_page"],
        preview: "contact",
        keywords: ["form", "services", "availability badge", "message"],
      },
      {
        id: "footer",
        label: "Footer",
        description: "The line at the bottom of every public page.",
        icon: Footprints,
        fields: ["footer_data"],
        preview: "home",
        keywords: ["copyright", "legal", "bottom"],
      },
    ],
  },
];

export const SETTINGS_GROUPS: readonly SettingsGroup[] =
  SETTINGS_SECTIONS.flatMap((section) => section.groups);

export const DEFAULT_GROUP_ID = SETTINGS_GROUPS[0].id;

export function findGroup(id: string): SettingsGroup {
  return SETTINGS_GROUPS.find((group) => group.id === id) ?? SETTINGS_GROUPS[0];
}

/**
 * Match a group against a search term.
 *
 * Searches the label, the description and the declared keywords — but also the
 * field paths, so typing `custom_theme_colors` or `bio` from memory finds the
 * group that owns it. Case- and separator-insensitive, because nobody types
 * `profile_data.status_panel` with the underscore in the right place.
 */
export function groupMatches(group: SettingsGroup, term: string): boolean {
  const needle = term
    .trim()
    .toLowerCase()
    .replace(/[_.\s-]+/g, " ");
  if (needle === "") return true;

  const haystack = [
    group.label,
    group.description,
    ...group.keywords,
    ...group.fields,
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[_.\s-]+/g, " ");

  return needle.split(" ").every((word) => haystack.includes(word));
}
