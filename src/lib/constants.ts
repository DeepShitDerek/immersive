export const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const BUCKET_NAME = process.env.NEXT_PUBLIC_BUCKET_NAME || "assets";

export const NOTE_COLORS = [
  "#f87171", // red
  "#fb923c", // orange
  "#facc15", // yellow
  "#4ade80", // green
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#c084fc", // purple
  "#818cf8", // indigo
] as const;

export const HABIT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ec4899", // pink
] as const;

/**
 * Fallbacks for rows written before a colour was required, and the starting
 * value for a new record. Both palettes are user data stored on the row — they
 * are deliberately not theme tokens, because a note keeps its colour when the
 * owner switches theme.
 */
export const DEFAULT_HABIT_COLOR = "#3b82f6";

// =============================================================================
// HABIT DEFINITION — mirrors the CHECK constraints in db/schema.sql
// =============================================================================

export const HABIT_KIND_OPTIONS = [
  {
    value: "build",
    label: "Build",
    hint: "Something you want to do more of",
  },
  {
    value: "quit",
    label: "Quit",
    hint: "Something you want to avoid — a log is a slip",
  },
] as const;

export const HABIT_SCHEDULE_OPTIONS = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "custom", label: "Certain days" },
  { value: "weekly_count", label: "Times per week" },
] as const;

export const HABIT_TIME_OF_DAY_OPTIONS = [
  { value: "anytime", label: "Anytime" },
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
] as const;

/** ISO weekday numbers, matching `habits.schedule_days`. */
export const WEEKDAYS = [
  { value: 1, short: "Mon", letter: "M" },
  { value: 2, short: "Tue", letter: "T" },
  { value: 3, short: "Wed", letter: "W" },
  { value: 4, short: "Thu", letter: "T" },
  { value: 5, short: "Fri", letter: "F" },
  { value: 6, short: "Sat", letter: "S" },
  { value: 7, short: "Sun", letter: "S" },
] as const;

/** Mirrors habits_target_value_positive / habit_logs_value_range. */
export const HABIT_VALUE_MAX = 100000;

export const TASK_STATUS = {
  TODO: "todo",
  IN_PROGRESS: "inprogress",
  REVIEW: "review",
  DONE: "done",
} as const;

export const TASK_STATUS_OPTIONS = [
  { value: TASK_STATUS.TODO, label: "To Do" },
  { value: TASK_STATUS.IN_PROGRESS, label: "In Progress" },
  { value: TASK_STATUS.REVIEW, label: "In Review" },
  { value: TASK_STATUS.DONE, label: "Done" },
] as const;

/**
 * Repeat rules. Stored as a plain string plus an interval rather than an RRULE:
 * the column's CHECK constraint enumerates exactly these three, and a personal
 * task list does not need the rest of the iCalendar grammar.
 */
export const TASK_RECURRENCE = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
} as const;

export const TASK_RECURRENCE_OPTIONS = [
  { value: TASK_RECURRENCE.DAILY, label: "Daily" },
  { value: TASK_RECURRENCE.WEEKLY, label: "Weekly" },
  { value: TASK_RECURRENCE.MONTHLY, label: "Monthly" },
] as const;

/** Mirrors the tasks_estimate_nonneg / tasks_tracked_nonneg CHECK bounds. */
export const TASK_MINUTES_MAX = 100000;
/** Mirrors tasks_recurrence_interval_valid. */
export const TASK_RECURRENCE_INTERVAL_MAX = 365;

export const TASK_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export const TASK_PRIORITY_OPTIONS = [
  { value: TASK_PRIORITY.LOW, label: "Low" },
  { value: TASK_PRIORITY.MEDIUM, label: "Medium" },
  { value: TASK_PRIORITY.HIGH, label: "High" },
] as const;

export const LEARNING_STATUS = {
  TO_LEARN: "To Learn",
  LEARNING: "Learning",
  PRACTICING: "Practicing",
  MASTERED: "Mastered",
} as const;

export const LIFE_UPDATE_CATEGORY = {
  WATCHING: "watching",
  ACTIVITY: "activity",
  PHOTO: "photo",
  THOUGHT: "thought",
  MILESTONE: "milestone",
} as const;

export const LIFE_UPDATE_CATEGORY_OPTIONS = [
  { value: LIFE_UPDATE_CATEGORY.WATCHING, label: "Watching" },
  { value: LIFE_UPDATE_CATEGORY.ACTIVITY, label: "Activity" },
  { value: LIFE_UPDATE_CATEGORY.PHOTO, label: "Photo" },
  { value: LIFE_UPDATE_CATEGORY.THOUGHT, label: "Thought" },
  { value: LIFE_UPDATE_CATEGORY.MILESTONE, label: "Milestone" },
] as const;

export const TYPOGRAPHY_PRESETS = [
  /* ── Sans systems ──────────────────────────────────────────────────────── */
  {
    value: "typo-default",
    label: "Developer Default",
    heading: "Space Grotesk",
    body: "Inter",
    code: "JetBrains Mono",
    weight: 700,
    serif: false,
    mood: "Sans",
    description: "Clean and versatile — the standard developer choice",
    pairing:
      "Space Grotesk's quirky geometric caps give headings a signature; Inter stays out of the way underneath.",
    families: ["Space Grotesk", "Inter", "JetBrains Mono"],
  },
  {
    value: "typo-modern-tech",
    label: "Product UI",
    heading: "Geist",
    body: "Geist",
    code: "Geist Mono",
    weight: 700,
    serif: false,
    mood: "Sans",
    description: "One family, weight-driven hierarchy — Vercel/Linear approach",
    pairing:
      "A single-family system. Hierarchy comes from weight and size rather than a second typeface, which is how most modern product interfaces are actually built.",
    families: ["Geist", "Geist Mono"],
  },
  {
    value: "typo-geometric",
    label: "Quiet Geometric",
    heading: "Onest",
    body: "Onest",
    code: "JetBrains Mono",
    weight: 700,
    serif: false,
    mood: "Sans",
    description: "Calm geometric sans with nothing to prove",
    pairing:
      "Also single-family. Onest has even, unfussy proportions that hold from a 12px label to a 48px headline.",
    families: ["Onest", "JetBrains Mono"],
  },
  {
    value: "typo-contemporary",
    label: "Contemporary",
    heading: "Funnel Display",
    body: "Funnel Sans",
    code: "Geist Mono",
    weight: 700,
    serif: false,
    mood: "Sans",
    description: "A designed display/text pair with 2025–26 character",
    pairing:
      "Funnel Display is tight and slightly condensed with real character; Funnel Sans is its calm text sibling, so the page reads as one voice at two volumes.",
    families: ["Funnel Display", "Funnel Sans", "Geist Mono"],
  },
  {
    value: "typo-bold-quirky",
    label: "Bold & Expressive",
    heading: "Bricolage Grotesque",
    body: "Inter",
    code: "JetBrains Mono",
    weight: 800,
    serif: false,
    mood: "Expressive",
    description:
      "Chunky variable display with a neutral body — creative portfolio",
    pairing:
      "Bricolage is loud and deliberately imperfect. It needs a body face with no opinions, which is exactly Inter's job.",
    families: ["Bricolage Grotesque", "Inter", "JetBrains Mono"],
  },
  {
    value: "typo-futuristic",
    label: "Futuristic",
    heading: "Unbounded",
    body: "Sora",
    code: "Fira Code",
    weight: 700,
    serif: false,
    mood: "Expressive",
    description: "Wide rounded display — cyberpunk and gaming aesthetic",
    pairing:
      "Unbounded is extremely wide, so it needs a body face with room in it. Sora's open apertures keep the pair from feeling cramped.",
    families: ["Unbounded", "Sora", "Fira Code"],
  },

  /* ── Serif display over sans body ──────────────────────────────────────── */
  {
    value: "typo-editorial",
    label: "Editorial Serif",
    heading: "Playfair Display",
    body: "DM Sans",
    code: "Fira Code",
    weight: 700,
    serif: true,
    mood: "Editorial",
    description:
      "Dramatic serif headlines with smooth body text — magazine-style",
    pairing:
      "The reference high-contrast pairing. Playfair's hairlines carry the drama; DM Sans's low contrast keeps the body calm.",
    families: ["Playfair Display", "DM Sans", "Fira Code"],
  },
  {
    value: "typo-elegant",
    label: "Elegant Minimal",
    heading: "Instrument Serif",
    body: "Manrope",
    code: "IBM Plex Mono",
    weight: 400,
    serif: true,
    mood: "Editorial",
    description: "Refined serif with airy body — Apple-inspired editorial",
    pairing:
      "Instrument Serif ships one weight and needs no other; setting it at 400 across large sizes is the whole effect.",
    families: ["Instrument Serif", "Manrope", "IBM Plex Mono"],
  },
  {
    value: "typo-modern-editorial",
    label: "Modern Editorial",
    heading: "Newsreader",
    body: "Figtree",
    code: "JetBrains Mono",
    weight: 500,
    serif: true,
    mood: "Editorial",
    description:
      "A screen-drawn optical-size serif over a clear geometric sans",
    pairing:
      "Newsreader sharpens its detail as it grows, so headlines feel set rather than scaled; Figtree keeps body text friendly and legible.",
    families: ["Newsreader", "Figtree", "JetBrains Mono"],
  },
  {
    value: "typo-classic-pro",
    label: "Classic Professional",
    heading: "Libre Baskerville",
    body: "Plus Jakarta Sans",
    code: "IBM Plex Mono",
    weight: 700,
    serif: true,
    mood: "Editorial",
    description: "Traditional serif authority with a modern body",
    pairing:
      "Libre Baskerville reads as institutional without being stuffy; Plus Jakarta Sans keeps the interface feeling current.",
    families: ["Libre Baskerville", "Plus Jakarta Sans", "IBM Plex Mono"],
  },

  /* ── Serif body — for reading, not for landing pages ───────────────────── */
  {
    value: "typo-longform",
    label: "Long-form Reading",
    heading: "Instrument Sans",
    body: "Lora",
    code: "IBM Plex Mono",
    weight: 600,
    serif: true,
    mood: "Reading",
    description: "Serif body tuned for screens — the one to pick for a blog",
    pairing:
      "The only preset with a serif *body*. Lora is drawn for screen reading at 16–18px; Instrument Sans keeps headings from turning the page into a novel.",
    families: ["Instrument Sans", "Lora", "IBM Plex Mono"],
  },
  {
    value: "typo-authority",
    label: "Data & Authority",
    heading: "Fraunces",
    body: "Chivo",
    code: "IBM Plex Mono",
    weight: 700,
    serif: true,
    mood: "Reading",
    description: "Old-style serif headings over a grotesque built for figures",
    pairing:
      "Fraunces carries institutional weight without a didone's fragility. Chivo handles dense numeric tables without looking out of place beneath it.",
    families: ["Fraunces", "Chivo", "IBM Plex Mono"],
  },

  /* ── Monospace and system ──────────────────────────────────────────────── */
  {
    value: "typo-terminal",
    label: "Terminal",
    heading: "JetBrains Mono",
    body: "Inter",
    code: "JetBrains Mono",
    weight: 700,
    serif: false,
    mono: true,
    mood: "Mono",
    description: "Monospace headings — pairs with the CRT and terminal themes",
    pairing:
      "Mono headings over a proportional body. Note this is the one preset with positive heading tracking: monospace caps are already tight on a fixed advance width.",
    families: ["JetBrains Mono", "Inter"],
  },
  {
    value: "typo-system",
    label: "System",
    heading: "system-ui",
    body: "system-ui",
    code: "ui-monospace",
    weight: 700,
    serif: false,
    mood: "System",
    description:
      "No webfont — instant render, zero layout shift, native on every OS",
    pairing:
      "Downloads nothing. On a slow connection this is the only preset that paints text immediately, and it always looks native.",
    families: [],
  },
] as const;

export const THEME_PRESETS = [
  { value: "theme-field-notes-light", label: "Field Notes" },
  { value: "theme-field-notes-dark", label: "Field Notes Dark" },
  { value: "theme-ink-light", label: "Ink" },
  { value: "theme-ink-dark", label: "Ink Noir" },
  { value: "theme-blueprint", label: "Blueprint" },
  { value: "theme-dracula", label: "Dracula" },
  { value: "theme-nord", label: "Nord" },
  { value: "theme-tokyo-night", label: "Tokyo Night" },
  { value: "theme-catppuccin-mocha", label: "Catppuccin Mocha" },
  { value: "theme-github-dark", label: "GitHub Dark" },
  { value: "theme-onedark-pro", label: "One Dark Pro" },
  { value: "theme-rose-pine", label: "Rosé Pine" },
  { value: "theme-monokai", label: "Monokai" },
  { value: "theme-ayu-dark", label: "Ayu Dark" },
  { value: "theme-solarized-light", label: "Solarized Light" },
  { value: "theme-catppuccin-latte", label: "Catppuccin Latte" },
  { value: "theme-github-light", label: "GitHub Light" },
  { value: "theme-arctic", label: "Arctic Frost" },
  { value: "theme-paper", label: "Paper White" },
  { value: "theme-cyberpunk", label: "Cyberpunk" },
  { value: "theme-ocean", label: "Ocean Deep" },
  { value: "theme-matrix", label: "Matrix" },
  { value: "theme-hc-dark", label: "High Contrast Dark" },
  { value: "theme-hc-light", label: "High Contrast Light" },
  { value: "theme-neobrutalism-light", label: "Neo-Brutalism Light" },
  { value: "theme-neobrutalism-dark", label: "Neo-Brutalism Dark" },
  { value: "theme-neobrutalism-punk", label: "Neo-Brutalism Punk" },
  { value: "theme-neobrutalism-gumroad", label: "Neo-Brutalism · Gumroad" },
  { value: "theme-neobrutalism-bauhaus", label: "Neo-Brutalism · Bauhaus" },
  { value: "theme-neobrutalism-memphis", label: "Neo-Brutalism · Memphis" },
  { value: "theme-neobrutalism-electric", label: "Neo-Brutalism · Electric" },
  { value: "theme-neobrutalism-butter", label: "Neo-Brutalism · Butter" },
  { value: "theme-neobrutalism-acid", label: "Neo-Brutalism · Acid" },
  { value: "theme-neobrutalism-teal", label: "Neo-Brutalism · Teal" },
  { value: "theme-glass-dark", label: "Liquid Glass Dark" },
  { value: "theme-glass-frost", label: "Liquid Glass Frost" },
  { value: "theme-glass-aurora", label: "Glass Aurora" },
  { value: "theme-glass-ocean", label: "Glass Ocean" },
  { value: "theme-synthwave", label: "Synthwave" },
  { value: "theme-retrowave", label: "Retrowave" },
  { value: "theme-terminal", label: "Terminal" },
  { value: "theme-solarized-dark", label: "Solarized Dark" },
  { value: "theme-gruvbox-dark", label: "Gruvbox Dark" },
  { value: "theme-gruvbox-light", label: "Gruvbox Light" },
  { value: "theme-tokyo-night-day", label: "Tokyo Night Day" },
  { value: "theme-everforest-dark", label: "Everforest" },
  { value: "theme-kanagawa", label: "Kanagawa" },
  { value: "theme-sepia", label: "Sepia" },
  { value: "theme-linear-dark", label: "Linear" },
  { value: "theme-mono-dark", label: "Mono Dark" },
  { value: "theme-mono-light", label: "Mono Light" },
  { value: "theme-stripe-light", label: "Stripe" },
  { value: "theme-aaa-light", label: "Accessible Light" },
  { value: "theme-aaa-dark", label: "Accessible Dark" },
  { value: "theme-flexoki-light", label: "Flexoki" },
  { value: "theme-flexoki-dark", label: "Flexoki Dark" },
  { value: "theme-rose-pine-dawn", label: "Rosé Pine Dawn" },
  { value: "theme-poimandres", label: "Poimandres" },
] as const;

// =============================================================================
// PUBLIC ROUTING CONTRACT
// =============================================================================

/**
 * Path segments the CMS catch-all must never generate.
 *
 * `(public)/[...slug]` turns every visible nav link into a prerendered route.
 * A segment listed here either already has a hand-written route file or is a
 * framework sentinel, so generating it would collide. This list used to live
 * inside the route file, which meant the admin had no way to tell the owner
 * that a path behaves differently — hence the move to shared constants.
 */
export const RESERVED_SEGMENTS = [
  "admin",
  "blog",
  "about",
  "contact",
  "work",
  "experience",
  "updates",
  "kit",
  "404",
  "500",
] as const;

/**
 * Public paths backed by a real route file under `src/app/(public)/`.
 *
 * Deliberately *not* the same as `RESERVED_SEGMENTS`. Reserving a segment only
 * stops the catch-all from generating it; it does not create a page. Three
 * reserved segments — `experience`, `404`, `500` — have no route, so a nav link
 * pointing at one renders a menu entry that 404s. The navigation admin uses the
 * difference between these two lists to say so.
 */
export const BUILTIN_ROUTES = [
  "/",
  "/about",
  "/blog",
  "/contact",
  "/work",
  "/updates",
  "/kit",
] as const;
