import {
  Banknote,
  BookMarked,
  BookText,
  BrainCircuit,
  Box,
  Calendar,
  CheckSquare,
  CloudSun,
  Database,
  Globe,
  Image,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LayoutTemplate,
  LineChart,
  ListTodo,
  Lock,
  Megaphone,
  Navigation,
  Presentation,
  Settings,
  ShieldCheck,
  StickyNote,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { PortfolioItem } from "@/types";
import { THEME_PRESETS, TYPOGRAPHY_PRESETS } from "@/lib/constants";
import { PRODUCT } from "@/lib/product";

/**
 * What /kit says about Foliokit.
 *
 * Every claim here is something the code does, and the figures are computed
 * from it — the theme count is `THEME_PRESETS.length`, not a number typed into
 * copy that drifts the next time a preset is added. `product-content.test.ts`
 * holds the rest to the code: every admin module is described, and no module
 * is described that does not exist.
 */

export interface WorkspaceModule {
  /** The admin route, so the tests can match it against the real navigation. */
  href: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

export const WORKSPACE: {
  group: string;
  description: string;
  modules: WorkspaceModule[];
}[] = [
  {
    group: "Publish",
    description: "Everything visitors see, edited in the browser.",
    modules: [
      {
        href: "/admin/content",
        name: "Pages",
        icon: LayoutTemplate,
        description:
          "Build any page from ready-made sections — services, case studies, results, FAQs.",
      },
      {
        href: "/admin/blog",
        name: "Blog",
        icon: BookText,
        description:
          "A block editor like Notion's. Drafts save themselves; live posts wait for Update.",
      },
      {
        href: "/admin/life-updates",
        name: "Updates",
        icon: Megaphone,
        description: "Short news for your /updates feed, pinned or dated.",
      },
      {
        href: "/admin/navigation",
        name: "Navigation",
        icon: Navigation,
        description: "Your menu — and which pages exist because of it.",
      },
      {
        href: "/admin/assets",
        name: "Assets",
        icon: Image,
        description: "Every uploaded image, and where it is used.",
      },
      {
        href: "/admin/inbox",
        name: "Inbox",
        icon: Inbox,
        description: "Contact-form messages, with optional Discord alerts.",
      },
    ],
  },
  {
    group: "Run your life",
    description: "A private workspace nobody else can see.",
    modules: [
      {
        href: "/admin/tasks",
        name: "Tasks",
        icon: ListTodo,
        description: "Board, table and tree views, with dependencies.",
      },
      {
        href: "/admin/notes",
        name: "Notes",
        icon: StickyNote,
        description: "Pages that link to each other and save as you type.",
      },
      {
        href: "/admin/calendar",
        name: "Calendar",
        icon: Calendar,
        description: "Events, tasks and habits on one calendar.",
      },
      {
        href: "/admin/finance",
        name: "Money",
        icon: Banknote,
        description:
          "Accounts, bank CSV import, recurring bills and a cash-flow forecast.",
      },
      {
        href: "/admin/habits",
        name: "Habits",
        icon: CheckSquare,
        description: "Streaks and heatmaps for the things you do daily.",
      },
      {
        href: "/admin/learning",
        name: "Learning",
        icon: BrainCircuit,
        description: "Subjects, topics and timed study sessions.",
      },
      {
        href: "/admin/library",
        name: "Library",
        icon: BookMarked,
        description: "What you read, and the lines worth keeping.",
      },
      {
        href: "/admin/whiteboard",
        name: "Whiteboard",
        icon: Presentation,
        description: "An Excalidraw board that works with a pen.",
      },
      {
        href: "/admin/inventory",
        name: "Inventory",
        icon: Box,
        description: "What you own and what it is worth.",
      },
      {
        href: "/admin/discover",
        name: "Discover",
        icon: CloudSun,
        description: "Markets, the job market and the news, in one place.",
      },
    ],
  },
  {
    group: "Keep an eye on it",
    description: "The site, its visitors and its safety.",
    modules: [
      {
        href: "/admin",
        name: "Dashboard",
        icon: LayoutDashboard,
        description: "Today, across every module.",
      },
      {
        href: "/admin/analytics",
        name: "Analytics",
        icon: LineChart,
        description:
          "Visits and what people read, without storing an IP address.",
      },
      {
        href: "/admin/settings",
        name: "Settings",
        icon: Settings,
        description:
          "Brand, theme, type and every public page, with live previews.",
      },
      {
        href: "/admin/security",
        name: "Security",
        icon: Lock,
        description:
          "Two-factor, password, and a switch to take the site offline.",
      },
    ],
  },
];

const WORKSPACE_MODULE_COUNT = WORKSPACE.reduce(
  (count, group) => count + group.modules.length,
  0,
);

/** The hero's figures — all counted from the code. */
export const PRODUCT_FACTS = [
  {
    value: String(THEME_PRESETS.length),
    label: "themes, each checked for WCAG AA contrast",
  },
  {
    value: String(TYPOGRAPHY_PRESETS.length),
    label: "type pairings, switchable at runtime",
  },
  {
    value: String(WORKSPACE_MODULE_COUNT),
    label: "workspace modules behind the site",
  },
  { value: "0", label: "servers to run — it is static files" },
];

export const MODES: {
  name: string;
  tagline: string;
  icon: LucideIcon;
  points: string[];
}[] = [
  {
    name: "A static site",
    tagline: "Free to host. One file to edit.",
    icon: Globe,
    points: [
      "Your name, work and links in portfolio.config.ts",
      "GitHub Pages, Netlify, Vercel or Cloudflare Pages",
      "No database and no environment variables",
      "Case studies, blog and updates from the same file",
    ],
  },
  {
    name: "With the workspace",
    tagline: "Connect Supabase and edit everything in the browser.",
    icon: Database,
    points: [
      "An admin for every page, post and update",
      "Tasks, notes, finance, habits, learning and more",
      "Mandatory two-factor sign-in",
      "Still static hosting — the browser talks to your own Supabase",
    ],
  },
];

export const SECURITY: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: KeyRound,
    title: "Two-factor, always",
    text: "Every write needs an authenticator-app session, enforced by the database rather than by a screen that could be skipped.",
  },
  {
    icon: ShieldCheck,
    title: "Row-level security on every table",
    text: "Visitors can read what you have published and nothing else.",
  },
  {
    icon: UserRound,
    title: "One owner per install",
    text: "Once your account exists, the database refuses further sign-ups.",
  },
  {
    icon: Lock,
    title: "Visitors stay anonymous",
    text: "Visits are counted with a daily salted hash. No IP address is ever stored.",
  },
];

/** A curated handful for the live preview; all of them are real presets. */
export const FEATURED_THEMES = [
  "theme-field-notes-light",
  "theme-field-notes-dark",
  "theme-ink-light",
  "theme-ink-dark",
  "theme-nord",
  "theme-dracula",
  "theme-tokyo-night",
  "theme-rose-pine",
  "theme-catppuccin-latte",
  "theme-solarized-light",
  "theme-blueprint",
  "theme-synthwave",
];

function asItems(
  prefix: string,
  rows: { title: string; subtitle?: string; description?: string }[],
): PortfolioItem[] {
  return rows.map((row, index) => ({
    id: `${prefix}-${index + 1}`,
    section_id: prefix,
    title: row.title,
    subtitle: row.subtitle ?? null,
    description: row.description ?? null,
    display_order: index,
  }));
}

export const QUICK_START = asItems("kit-start", [
  {
    title: "Clone it",
    subtitle: "git and npm",
    description: "Clone the repository and run `npm install`.",
  },
  {
    title: "Make it yours",
    subtitle: "One config file",
    description:
      "Put your name, work and links in `portfolio.config.ts`, and pick a theme.",
  },
  {
    title: "Deploy",
    subtitle: "Push to main",
    description:
      "The included GitHub Pages workflow builds and publishes it. Any static host works.",
  },
  {
    title: "Add the workspace",
    subtitle: "Optional",
    description:
      "Create a Supabase project, run `db/schema.sql`, add two keys — then sign up and enrol two-factor.",
  },
]);

export const QUICK_START_CODE = [
  "```bash",
  `git clone ${PRODUCT.repoUrl || "https://github.com/you/foliokit"}.git`,
  "cd foliokit && npm install",
  "npm run dev",
  "```",
].join("\n");

export const FAQ = asItems("kit-faq", [
  {
    title: "Do I need a server?",
    description:
      "No. The site builds to static files and runs on GitHub Pages, Netlify, Vercel, Cloudflare Pages or any static host. With the workspace connected, the browser talks to your own Supabase project directly.",
  },
  {
    title: "What does it cost to run?",
    description:
      "The static site costs nothing beyond a domain, if you want one. The workspace runs on Supabase's free tier, and an included workflow pings it daily so a quiet project is not paused.",
  },
  {
    title: "Who owns my data?",
    description:
      "You do. It lives in your own Supabase project, behind row-level security and mandatory two-factor sign-in. There is no Foliokit server in the middle.",
  },
  {
    title: "Can other people sign up to my site?",
    description:
      "No. Each install has one owner, enforced by the database: once your account exists, further sign-ups are refused.",
  },
  {
    title: "Can I change how it looks?",
    description: `Yes — ${THEME_PRESETS.length} themes and ${TYPOGRAPHY_PRESETS.length} type pairings switch at runtime, each theme checked for WCAG AA contrast, and you can set your own colours.`,
  },
  {
    title: "What's the licence?",
    description: "MIT. Use it for personal or commercial work.",
  },
]);
