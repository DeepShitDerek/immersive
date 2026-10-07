import { DEFAULT_THEME } from "./themes";

/**
 * The canonical empty `site_identity` shape.
 *
 * Deliberately kept in its own module with **no Zod import**. It is consumed
 * both by `schemas.ts` (as the settings form's `defaultValues`) and by
 * `site-identity.ts`, which normalises the public `getSiteIdentity` response.
 * `publicApi` is on every route, so importing it from `schemas.ts` pulled Zod
 * and all ~20 entity schemas into the first load of every public page.
 *
 * `schemas.ts` re-exports this as `siteSettingsDefaultValues` with the
 * `SiteSettingsFormValues` annotation, so the literal is still type-checked
 * against the schema — just at that site rather than this one.
 */
export const SITE_IDENTITY_DEFAULTS = {
  portfolio_mode: "multi-page",
  profile_data: {
    name: "",
    title: "",
    description: "",
    headline: "",
    proof: [] as { value: string; label: string }[],
    profile_picture_url: "",
    // Must track the app default; this was pinned to "theme-blueprint" long
    // after the v2 identity moved to Ink, so a fresh settings form offered a
    // starting theme the rest of the app no longer defaults to.
    default_theme: DEFAULT_THEME,
    custom_theme_colors: {
      background: "#0f172a",
      foreground: "#e2e8f0",
      primary: "#0ea5e9",
      secondary: "#1e293b",
      accent: "#38bdf8",
      card: "#1e293b",
    },
    show_profile_picture: true,
    logo: { main: "", highlight: "" },
    bio: [""],
    status_panel: {
      show: true,
      design: "minimal",
      title: "Status Panel",
      availability: "",
      currently_exploring: { title: "Exploring", items: [""] },
      latestProject: { name: "", linkText: "", href: "" },
    },
    github_projects_config: {
      username: "",
      show: true,
      sort_by: "pushed",
      exclude_forks: true,
      exclude_archived: true,
      exclude_profile_repo: true,
      min_stars: 1,
      projects_per_page: 9,
    },
    contact_page: {
      show_contact_form: true,
      show_availability_badge: true,
      show_services: true,
    },
    updates_layout: "scrapbook",
    typography_preset: "typo-default",
  },
  social_links: [
    { id: "github", label: "GitHub", url: "", is_visible: true },
    { id: "linkedin", label: "LinkedIn", url: "", is_visible: true },
    { id: "email", label: "Email", url: "", is_visible: true },
  ],
  footer_data: {
    copyright_text: "",
    links: [{ label: "Updates", href: "/updates" }],
  },
} as const;
