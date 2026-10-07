// Auto-generated from portfolio.config.ts — edit the config file, not this one.

import type {
  SiteContent,
  PortfolioSection,
  BlogPost,
  LifeUpdate,
  PublicHighlight,
} from "@/types";
import config from "../../portfolio.config";

// --- 0. NAVIGATION ---
export const MOCK_NAV_LINKS = config.navLinks;

// --- 1. GLOBAL IDENTITY (Header, Footer, Hero) ---
export const MOCK_SITE_IDENTITY: SiteContent = {
  portfolio_mode: config.portfolioMode,
  profile_data: {
    name: config.name,
    title: config.title,
    description: config.description,
    headline: config.headline,
    proof: config.proof,
    profile_picture_url: config.profilePicture,
    show_profile_picture: config.showProfilePicture,
    default_theme: config.defaultTheme,
    logo: config.logo,
    status_panel: {
      show: config.statusPanel.show,
      design: config.statusPanel.design,
      title: config.statusPanel.title,
      availability: config.statusPanel.availability,
      currently_exploring: {
        title: config.statusPanel.currentlyExploring.title,
        items: config.statusPanel.currentlyExploring.items,
      },
      latestProject: config.statusPanel.latestProject,
    },
    bio: config.bio,
    github_projects_config: {
      username: config.github.username,
      show: config.github.show,
      sort_by: config.github.sortBy,
      exclude_forks: config.github.excludeForks,
      exclude_archived: config.github.excludeArchived,
      exclude_profile_repo: config.github.excludeProfileRepo,
      min_stars: config.github.minStars,
      projects_per_page: config.github.projectsPerPage,
    },
    contact_page: {
      show_contact_form: config.contact.showContactForm,
      show_availability_badge: config.contact.showAvailabilityBadge,
      show_services: config.contact.showServices,
    },
    updates_layout: config.updatesLayout,
    typography_preset: config.typographyPreset,
  },
  social_links: config.socialLinks.map((link) => ({
    ...link,
    is_visible: true,
  })),
  footer_data: {
    copyright_text: config.footerText,
    links: config.footerLinks,
  },
};

// --- 2. LIFE UPDATES (For /updates) ---
export const MOCK_LIFE_UPDATES: LifeUpdate[] = config.lifeUpdates.map(
  (update, i) => ({
    id: `lu-${i + 1}`,
    title: update.title,
    content: update.content,
    category: update.category,
    tags: update.tags,
    is_pinned: update.isPinned,
    is_published: true,
    created_at: new Date(Date.now() - 86400000 * i * 3).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * i * 3).toISOString(),
  }),
);

// --- 3. BLOG POSTS (For /blog) ---

/**
 * Whether a post from portfolio.config.ts may appear on the site.
 * `draft: true` keeps it out of the list, its page and its link-preview card
 * — the static-mode twin of `published = false` in the database,
 * which static mode otherwise has no way to say.
 */
export function isPublicConfigPost(post: object): boolean {
  return !("draft" in post && (post as { draft?: unknown }).draft === true);
}

export const MOCK_BLOG_POSTS: BlogPost[] = config.blogPosts
  .filter(isPublicConfigPost)
  .map((post, i) => ({
    id: String(i + 1),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    published: true,
    published_at: new Date(Date.now() - 86400000 * i * 5).toISOString(),
    show_toc: post.showToc ?? false,
    tags: post.tags,
    // views: 0, // If you wants to show the No. of Views
    created_at: new Date(Date.now() - 86400000 * i * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * i * 5).toISOString(),
  }));

// --- 4. SECTIONS (For Home, About, Work, Contact) ---

// Helper to build section items
function buildItems(
  sectionId: string,
  items: {
    title: string;
    subtitle?: string;
    description?: string;
    from?: string;
    to?: string;
    tags?: string[];
    link?: string;
    image?: string;
    company?: string;
    institution?: string;
  }[],
) {
  return items.map((item, i) => ({
    id: `${sectionId}-${i + 1}`,
    section_id: sectionId,
    title: item.title,
    subtitle: item.subtitle || item.company || item.institution,
    date_from: item.from,
    date_to: item.to,
    description: item.description,
    tags: item.tags,
    link_url: item.link,
    image_url: item.image,
  }));
}

export const MOCK_SECTIONS: PortfolioSection[] = [
  // --- HOME PAGE (/) ---
  // Ordered as a pitch rather than a CV: what I do, proof that it works, how
  // working together goes — then the track record and the toolkit behind it.
  {
    id: "home-services",
    title: "What I do",
    type: "list_items",
    page_path: "/",
    layout_style: "services",
    is_visible: true,
    display_order: 1,
    portfolio_items: buildItems(
      "home-services",
      config.services.map((s) => ({
        title: s.title,
        subtitle: s.subtitle,
        description: s.description,
        tags: s.tags,
      })),
    ),
  },
  // No "Selected work" here: the home page draws it from /work (FeaturedWork),
  // and a second copy repeated the same projects twice on one page.
  {
    id: "home-process",
    title: "How I work",
    type: "list_items",
    page_path: "/",
    layout_style: "process",
    is_visible: true,
    display_order: 3,
    portfolio_items: buildItems(
      "home-process",
      config.process.map((p) => ({
        title: p.title,
        subtitle: p.duration,
        description: p.description,
      })),
    ),
  },
  {
    id: "home-exp",
    title: "Experience",
    type: "list_items",
    page_path: "/",
    layout_style: "work-experience",
    is_visible: true,
    display_order: 4,
    portfolio_items: buildItems(
      "home-exp",
      config.experience.map((e) => ({
        title: e.title,
        company: e.company,
        from: e.from,
        to: e.to,
        description: e.description,
        tags: e.tags,
      })),
    ),
  },
  {
    id: "home-tech",
    title: "Toolkit",
    type: "list_items",
    page_path: "/",
    layout_style: "compact-cards",
    is_visible: true,
    display_order: 5,
    portfolio_items: buildItems("home-tech", config.techStack),
  },

  // --- WORK PAGE (/work): case studies first, then projects ---
  {
    id: "showcase-deep",
    title: "Selected work",
    type: "list_items",
    page_path: "/work",
    // The case-study layout, as on the home page: problem, approach, outcome
    // — not a two-column grid of equal tiles.
    layout_style: "case-study",
    is_visible: true,
    display_order: 1,
    portfolio_items: buildItems("showcase-deep", config.showcase),
  },

  // --- ABOUT PAGE (/about) ---
  {
    id: "about-edu",
    title: "Education",
    type: "list_items",
    page_path: "/about",
    layout_style: "timeline",
    is_visible: true,
    display_order: 1,
    portfolio_items: buildItems(
      "about-edu",
      config.education.map((e) => ({
        title: e.title,
        institution: e.institution,
        from: e.from,
        to: e.to,
        description: e.description,
      })),
    ),
  },
  {
    id: "about-exp",
    title: "Experience",
    type: "list_items",
    page_path: "/about",
    layout_style: "timeline",
    is_visible: true,
    display_order: 2,
    portfolio_items: buildItems(
      "about-exp",
      config.experience.map((e) => ({
        title: e.title,
        company: e.company,
        from: e.from,
        to: e.to,
        description: e.description,
        tags: e.tags,
      })),
    ),
  },

  {
    id: "about-tools",
    title: "Security tooling",
    type: "list_items",
    page_path: "/about",
    layout_style: "compact-cards",
    is_visible: true,
    display_order: 3,
    portfolio_items: buildItems("about-tools", config.tools),
  },

  {
    id: "projects-featured",
    title: "Featured Projects",
    type: "list_items",
    page_path: "/work",
    layout_style: "feature-alternating",
    is_visible: true,
    display_order: 2,
    portfolio_items: buildItems(
      "projects-featured",
      config.projects.map((p) => ({
        title: p.title,
        subtitle: p.subtitle,
        description: p.description,
        tags: p.tags,
        link: p.link,
        image: p.image,
      })),
    ),
  },

  // --- CONTACT PAGE (/contact) ---
  {
    id: "contact-services",
    title: "Services",
    type: "list_items",
    page_path: "/contact",
    layout_style: "default",
    is_visible: true,
    display_order: 1,
    portfolio_items: buildItems(
      "contact-services",
      config.services.map((s) => ({
        title: s.title,
        subtitle: s.subtitle,
        description: s.description,
        tags: s.tags,
      })),
    ),
  },
];

// --- LIBRARY: the random highlight, with no database ---
//
// Written here rather than in portfolio.config.ts: it is sample content for the
// zero-config demo, not something a visitor of a configured site would ever
// see. Every line is quoted from its original source, with that source named —
// a quote widget that misattributes is worse than none.
export const MOCK_HIGHLIGHTS: PublicHighlight[] = [
  {
    id: "mock-highlight-1",
    text: "The purpose of abstraction is not to be vague, but to create a new semantic level in which one can be absolutely precise.",
    attribution: null,
    location: null,
    source_title: "The Humble Programmer",
    source_creator: "Edsger W. Dijkstra",
    source_kind: "article",
    source_url: null,
  },
  {
    id: "mock-highlight-2",
    text: "Programs must be written for people to read, and only incidentally for machines to execute.",
    attribution: null,
    location: "Preface",
    source_title: "Structure and Interpretation of Computer Programs",
    source_creator: "Harold Abelson and Gerald Jay Sussman",
    source_kind: "book",
    source_url: null,
  },
  {
    id: "mock-highlight-3",
    text: "Premature optimization is the root of all evil (or at least most of it) in programming.",
    attribution: null,
    location: null,
    source_title: "Structured Programming with go to Statements",
    source_creator: "Donald E. Knuth",
    source_kind: "article",
    source_url: null,
  },
];
