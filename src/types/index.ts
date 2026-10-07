import type { SiteStyle } from "@/lib/site-style";
// =============================================================================
// API TYPES
// =============================================================================

/** Standardized API error response */
export interface ApiError {
  message: string;
  details?: string;
  hint?: string;
  code?: string;
}

// =============================================================================
// NAVIGATION & CONTENT MANAGEMENT
// =============================================================================

export interface NavLink {
  id: string;
  label: string;
  href: string;
  display_order: number;
  is_visible: boolean;
}

export interface StorageAsset {
  id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_kb: number | null;
  alt_text: string | null;
  used_in: { type: string; id: string }[] | null;
  created_at: string;
}

// =============================================================================
// PORTFOLIO
// =============================================================================

export interface PortfolioSection {
  id: string;
  user_id?: string;
  title: string;
  type: "markdown" | "list_items" | "gallery";
  content?: string | null;
  display_order?: number;
  created_at?: string;
  updated_at?: string;
  is_visible: boolean;
  /**
   * Whether the public page shows the section's title. Absent on fallback
   * data and on a database set up from an older schema, where it means shown.
   */
  show_title?: boolean;
  page_path: string;
  layout_style: string;
  portfolio_items?: PortfolioItem[];
}

export interface PortfolioItem {
  id: string;
  section_id: string;
  user_id?: string;
  title: string;
  subtitle?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  description?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  tags?: string[] | null;
  internal_notes?: string | null;
  /**
   * The item this one fed into, if any.
   *
   * Concurrency on the timeline is *derived* from overlapping dates, which is
   * honest. A merge is not derivable — "these ended near each other" is a
   * different claim from "one became the other" — so it is stated.
   */
  merged_into_id?: string | null;
  display_order?: number;
  /** Case study: with a non-blank `case_study`, the page is /work/<slug>/. */
  slug?: string | null;
  /** Markdown. Not in list queries; read `has_case_study` there. */
  case_study?: string | null;
  /** Generated: slug set and body non-blank. */
  has_case_study?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** An item that has a case-study page. */
export type CaseStudy = PortfolioItem & { slug: string; case_study: string };

export interface BlogPost {
  id: string;
  user_id?: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  cover_image_url?: string | null;
  published?: boolean;
  published_at?: string | null;
  show_toc: boolean;
  tags?: string[] | null;
  views?: number;
  internal_notes?: string | null;
  /** Maintained by the database (generated column); absent in mock data. */
  word_count?: number;
  created_at?: string;
  updated_at?: string;
}

interface GitHubRepoOwner {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  private: boolean;
  archived: boolean;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  languages_url?: string;
  topics?: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage?: string | null;
  owner: GitHubRepoOwner;
}

export interface Event {
  id: string;
  user_id?: string;
  title: string;
  description?: string | null;
  start_time: string;
  end_time?: string | null;
  is_all_day?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Note {
  id: string;
  user_id?: string;
  title?: string | null;
  /** Markdown. `[[wikilinks]]` inside it are resolved against note titles. */
  content?: string | null;
  tags?: string[] | null;
  is_pinned?: boolean;
  color?: string | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * An Excalidraw scene. `elements`, `app_state`, and `files` are stored exactly
 * as the library hands them over, so a board always round-trips; they are
 * deliberately loose (`unknown[]` / record) rather than mirroring Excalidraw's
 * internal types, which change between minor versions.
 */
/** A Maps list row. The graph itself is not loaded for the list. */
export interface ThinkingMapSummary {
  id: string;
  name: string;
  node_count: number;
  edge_count: number;
  is_pinned: boolean;
  /** Optimistic-concurrency counter; see db/schema.sql §20. */
  revision: number;
  created_at: string;
  updated_at: string;
}

/** A map with its document — see features/maps/domain/serialize.ts. */
export interface ThinkingMap extends ThinkingMapSummary {
  doc: unknown;
  schema_version: number;
}

export interface Whiteboard {
  id: string;
  user_id?: string;
  title?: string | null;
  /** Scene elements; omitted by the list query, loaded when a board is opened. */
  elements?: unknown[];
  /** Viewport and tool state — scroll, zoom, background, active colors. */
  app_state?: Record<string, unknown> | null;
  /** Binary files (pasted images) keyed by file id. */
  files?: Record<string, unknown> | null;
  /** SVG thumbnail rendered at save time so the gallery needs no scene data. */
  preview?: string | null;
  tags?: string[] | null;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type LifeUpdateCategory =
  | "watching"
  | "activity"
  | "photo"
  | "thought"
  | "milestone";

export interface LifeUpdate {
  id: string;
  user_id?: string;
  title?: string | null;
  content?: string | null;
  category: LifeUpdateCategory;
  image_url?: string | null;
  tags?: string[] | null;
  is_pinned?: boolean;
  is_published?: boolean;
  created_at?: string;
  updated_at?: string;
}
export interface SubTask {
  id: string;
  task_id: string;
  user_id?: string;
  title: string;
  is_completed: boolean;
  created_at?: string;
}

export type TaskRecurrence = "daily" | "weekly" | "monthly";

export interface TaskProject {
  id: string;
  user_id?: string;
  name: string;
  color?: string | null;
  display_order?: number;
  is_archived?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** `task_id` is blocked by `depends_on_id`. */
export interface TaskDependency {
  id: string;
  user_id?: string;
  task_id: string;
  depends_on_id: string;
  created_at?: string;
}

export interface Task {
  id: string;
  user_id?: string;
  project_id?: string | null;
  title: string;
  description?: string | null;
  /**
   * "blocked" is absent on purpose — it is derived from unmet dependencies
   * rather than stored, so a saved value could disagree with the graph.
   */
  status?: "todo" | "inprogress" | "review" | "done";
  priority?: "low" | "medium" | "high";
  start_date?: string | null;
  due_date?: string | null;
  tags?: string[] | null;
  display_order?: number;
  estimate_minutes?: number | null;
  tracked_minutes?: number | null;
  completed_at?: string | null;
  recurrence?: TaskRecurrence | null;
  recurrence_interval?: number | null;
  recurrence_parent_id?: string | null;
  created_at?: string;
  updated_at?: string;
  sub_tasks?: SubTask[];
}

type HabitKind = "build" | "quit";
type HabitSchedule =
  | "daily"
  | "weekdays"
  | "weekends"
  | "custom"
  | "weekly_count";
type HabitTimeOfDay = "anytime" | "morning" | "afternoon" | "evening";

export interface Habit {
  id: string;
  user_id?: string;
  title: string;
  /**
   * `color`, `target_per_week` and `is_active` are nullable columns with
   * defaults. Rows created through the form always carry them, but the type
   * described a guarantee the schema does not make.
   */
  color?: string | null;
  /** A "quit" habit inverts success: a log is a slip, not an achievement. */
  kind?: HabitKind | null;
  /** A plain check-in is target_value 1 with no unit. */
  target_value?: number | null;
  unit?: string | null;
  step?: number | null;
  schedule?: HabitSchedule | null;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. Only used when schedule="custom". */
  schedule_days?: number[] | null;
  target_per_week?: number | null;
  time_of_day?: HabitTimeOfDay | null;
  category?: string | null;
  notes?: string | null;
  display_order?: number;
  is_active?: boolean | null;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
  habit_logs?: HabitLog[]; // Joined data
}

export interface HabitLog {
  id: string;
  habit_id: string;
  completed_date: string; // YYYY-MM-DD
  /** How much was done. Absence of a row means not done at all. */
  value?: number | null;
  note?: string | null;
}

export interface LearningSubject {
  id: string;
  user_id?: string;
  name: string;
  description?: string | null;
  color?: string | null;
  /** Weekly, not daily: a daily target turns one bad day into a failure. */
  target_minutes_per_week?: number | null;
  archived_at?: string | null;
  display_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type LearningStatus =
  | "To Learn"
  | "Learning"
  | "Practicing"
  | "Mastered";

export type LearningMaterialKind = "reference" | "recall" | "quiz";

export interface LearningTopic {
  id: string;
  user_id?: string;
  /** Nullable FK — a topic outlives the module it was filed under. */
  subject_id?: string | null;
  title: string;
  /**
   * What kind of material this is.
   *
   * `reference` is read and never enters the recall queue; `recall` is the
   * classic prompt-then-reveal and remains the default so every existing row
   * behaves exactly as it did; `quiz` carries a right answer to be marked
   * against. Nullable because the column has a default — consumers fall back
   * to "recall".
   */
  kind?: LearningMaterialKind | null;
  /** Nullable column with a default; consumers fall back to "To Learn". */
  status?: LearningStatus | null;
  /**
   * The question you are actually asked, as distinct from `title`, which is
   * the label you scan in a list. Falls back to the title when absent.
   */
  prompt?: string | null;
  /** The expected answer, for `quiz`. */
  answer?: string | null;
  /**
   * Multiple choice options, when there are any. The correct one is `answer`,
   * matched by value rather than by index, so reordering the options cannot
   * silently change which is right.
   */
  choices?: string[] | null;
  core_notes?: string | null;
  resources?: { name: string; url: string }[] | null;
  confidence_score?: number | null;
  /** Spaced review state. `due_date` null means never reviewed — new, not
      overdue; the distinction is what stops the queue reading as debt. */
  ease?: number | null;
  interval_days?: number | null;
  due_date?: string | null;
  last_reviewed_at?: string | null;
  review_count?: number | null;
  lapses?: number | null;
  archived_at?: string | null;
  display_order?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type LearningReviewRating = "again" | "hard" | "good" | "easy";

export interface LearningReview {
  id: string;
  user_id?: string;
  topic_id: string;
  reviewed_at: string;
  rating: LearningReviewRating;
  interval_before?: number | null;
  interval_after?: number | null;
  ease_after?: number | null;
}

export interface LearningSession {
  id: string;
  user_id?: string;
  topic_id: string;
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  journal_notes?: string | null;
  created_at?: string;
}

export interface SiteContent {
  portfolio_mode: "multi-page" | "single-page";
  profile_data: {
    name: string;
    title: string;
    description: string;
    profile_picture_url: string;
    show_profile_picture: boolean;
    default_theme: string;
    custom_theme_colors?: {
      background: string;
      foreground: string;
      primary: string;
      secondary: string;
      accent: string;
      card: string;
    };
    logo: {
      main: string;
      highlight: string;
    };
    status_panel: {
      show: boolean;
      design?: "minimal" | "terminal" | "bento";
      title: string;
      availability: string;
      currently_exploring: {
        title: string;
        items: string[];
      };
      latestProject: {
        name: string;
        linkText: string;
        href: string;
      };
    };
    /** The home page's main heading. Empty: the name leads instead. */
    headline: string;
    /** Results under the hero — `value` is the figure, `label` what it measures. */
    proof: { value: string; label: string }[];
    bio: string[];
    github_projects_config: {
      username: string;
      show: boolean;
      sort_by: "created" | "updated" | "pushed";
      exclude_forks: boolean;
      exclude_archived: boolean;
      exclude_profile_repo: boolean;
      min_stars: number;
      projects_per_page: number;
    };
    contact_page: {
      show_contact_form: boolean;
      show_availability_badge: boolean;
      show_services: boolean;
    };
    updates_layout?: "timeline" | "scrapbook";
    typography_preset?: string;
    /** Classic, or an immersive style for the public site. Unknown → classic. */
    site_style?: SiteStyle;
  };
  social_links: {
    id: string;
    label: string;
    url: string;
    is_visible: boolean;
  }[];
  footer_data: {
    copyright_text: string;
    /** Footer-only links, after the nav. Defaults to Updates. */
    links?: { label: string; href: string }[];
  };
}

export interface InventoryItem {
  id: string;
  user_id?: string;
  name: string;
  /**
   * `category` and `purchase_price` are nullable columns on `inventory_items`.
   * They were typed as required here, so any row written before the form
   * enforced them — or inserted outside the app — crashed the table on
   * `purchase_price.toLocaleString()`. The form still requires both; the type
   * now describes what the database can actually return.
   */
  category?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  warranty_expiry?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  /** ISO 4217; null (or absent before the column existed) = money base currency. */
  currency?: string | null;
  image_url?: string | null;
  notes?: string | null;
  /** Where the thing is. */
  location?: string | null;
  quantity?: number | null;
  tags?: string[] | null;
  /** Set when the object is gone; the row survives for its purchase price. */
  archived_at?: string | null;
  archived_reason?: InventoryArchiveReason | null;
  transaction_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

type InventoryArchiveReason =
  | "sold"
  | "gifted"
  | "lost"
  | "discarded"
  | "returned";

// =============================================================================
// DASHBOARD
// =============================================================================

export interface DashboardData {
  /** Whole rows: the dashboard completes them, recurrence included. */
  overdueTasks: Task[];
  /** Due today, finished ones included, so the day's progress can move. */
  tasksDueToday: Task[];
  /** Minutes of focus-timer work logged today. */
  focusMinutesToday: number;
  /**
   * Money in and out per day, in the base currency, from `money_day_flows`.
   *
   * Major units, unlike the rest of the money module: the RPC divides by the base
   * currency's exponent so the one division happens in one place, and the
   * dashboard formats them with the shared `formatMoney({ amount, currency })`.
   */
  dailyExpenses: { day: string; total: number }[];
  dailyEarnings: { day: string; total: number }[];
  /** Active habits with their logs, so "done today" is derived, not stored. */
  habits: Habit[];
  todaysEvents: Pick<
    Event,
    "id" | "title" | "start_time" | "end_time" | "is_all_day"
  >[];
  unreadMessages: number;
  reviewsDue: number;
}

/**
 * A message from the public contact form.
 *
 * The only row in the database an unauthenticated visitor can create, which is
 * why its bounds and rate limit live in Postgres rather than only in the form.
 */
export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Role / project / other; null on messages from before it. */
  topic?: "role" | "project" | "other" | null;
  is_read: boolean;
  is_archived: boolean;
  /** Set when you mark it answered; null until then. */
  replied_at: string | null;
  created_at: string;
}

/**
 * Integration secrets, in their own admin-only table.
 *
 * Not part of `SiteContent`: `site_identity` is publicly readable, so a
 * webhook URL there would be visible to every visitor.
 */
export interface IntegrationSettings {
  /**
   * A market-data key the owner supplies.
   *
   * Lives here rather than in an env var because this table has RLS and no
   * public read policy at all, and Discover is an admin route — so the owner's
   * browser can read it and it never enters the bundle. A `NEXT_PUBLIC_*` key
   * in a static export is a published key.
   */
  market_data_key?: string | null;
  market_data_provider?: "finnhub" | "twelvedata" | null;
  id: number;
  contact_webhook_url: string | null;
  notify_on_contact: boolean;
  visit_webhook_url: string | null;
  /** Off by default — a ping per page view is noise you mute within a week. */
  notify_on_visit: boolean;
  updated_at?: string;
}

// =============================================================================
// VISITOR ANALYTICS
// =============================================================================

/** One `{ name, value }` slice of a visitor breakdown. */
export interface VisitorSlice {
  name: string;
  value: number;
}

/**
 * The shape `get_visitor_analytics(days, with_bots)` returns.
 *
 * Aggregated in Postgres rather than in the browser: a year of traffic is tens
 * of thousands of rows and the admin only ever renders the summary of them.
 */
export interface VisitorAnalytics {
  range_days: number;
  total_views: number;
  /**
   * Distinct `visitor_hash` values. Zero while views are non-zero means the
   * request IP never reached Postgres, so no hash could be derived — worth
   * saying out loud rather than reporting "0 visitors" as if it were a count.
   */
  total_visitors: number;
  bot_views: number;
  by_day: { day: string; views: number; visitors: number }[];
  top_pages: VisitorSlice[];
  top_sources: VisitorSlice[];
  by_channel: VisitorSlice[];
  by_country: (VisitorSlice & { visitors: number })[];
  by_city: (VisitorSlice & { country: string | null })[];
  by_network: VisitorSlice[];
  by_browser: VisitorSlice[];
  by_os: VisitorSlice[];
  by_device: VisitorSlice[];
  by_hour: { hour: number; value: number }[];
}

// =============================================================================
// CALENDAR
// =============================================================================

/** One of the app's chart tokens, resolved to a colour at render time. */
export type CalendarColorToken =
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5";

export interface Calendar {
  id: string;
  user_id?: string;
  name: string;
  /**
   * A token name, not a hex value. The previous module hard-coded nine
   * literals copied from Google Calendar, which did not move with any of the
   * 52 theme presets.
   */
  color_token: CalendarColorToken;
  is_visible: boolean;
  is_default: boolean;
  sort_order: number;
  archived_at?: string | null;
}

export interface CalendarSettings {
  user_id?: string;
  /** IANA zone. Null hides the second hour gutter entirely. */
  home_timezone?: string | null;
  day_start_hour: number;
  day_end_hour: number;
  /** 0 = Sunday. */
  week_starts_on: number;
  default_view: "day" | "week" | "month" | "agenda";
  show_tasks: boolean;
  show_habits: boolean;
  show_finance: boolean;
}

/**
 * A moved or cancelled occurrence of a recurring series.
 *
 * Keyed by `original_start`, because that is the only stable identifier an
 * expanded occurrence has — it is computed from the rule rather than stored.
 */
export interface EventException {
  id: string;
  user_id?: string;
  event_id: string;
  original_start: string;
  is_cancelled: boolean;
  new_start?: string | null;
  new_end?: string | null;
  new_title?: string | null;
}

/** A row as `get_calendar_data` returns it. */
export interface CalendarRow {
  item_id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  item_type: "event" | "task" | "habit_summary" | "transaction_summary";
  is_all_day: boolean;
  data: Record<string, unknown>;
}

/**
 * One thing on the grid, after recurrence has been expanded.
 *
 * `id` is unique per *occurrence*, not per row: a weekly standup is one
 * database row and fifty-two of these.
 */
export interface CalendarEntry {
  id: string;
  /** The database row this came from. Same for every occurrence of a series. */
  sourceId: string;
  kind: CalendarRow["item_type"];
  title: string;
  start: Date;
  end: Date;
  isAllDay: boolean;
  colorToken?: CalendarColorToken | null;
  calendarId?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  description?: string | null;
  status?: "confirmed" | "tentative" | "cancelled";
  /** Present when this is one occurrence of a recurring series. */
  rrule?: string | null;
  /** The start this occurrence would have had, for writing an exception. */
  occurrenceStart?: Date;
  /**
   * The series' own first start (the row's start_time). Moving or editing
   * "the whole series" from one occurrence shifts this by the same amount;
   * writing the occurrence's date here instead would drop every earlier
   * occurrence.
   */
  seriesStart?: Date;
  /**
   * Set when this occurrence has been detached from its series by an
   * exception row. Carrying the id is what makes the change reversible — the
   * sheet can offer to put the occurrence back rather than leaving a moved
   * meeting permanently out of step with the rest.
   */
  exceptionId?: string;
  taskId?: string | null;
  data?: Record<string, unknown>;
}

/**
 * A place the Discover module shows weather for.
 *
 * Two is the interesting number: where you are, and where the people you left
 * behind are.
 */
export interface DiscoverPlace {
  id: string;
  user_id?: string;
  label: string;
  latitude: number;
  longitude: number;
  /** An IANA zone, so the forecast reads in the place's own clock. */
  timezone?: string | null;
  sort_order: number;
  created_at?: string;
}

/** A subject to follow, and which keyless service answers for it. */
export interface DiscoverTopic {
  id: string;
  user_id?: string;
  term: string;
  source: "hackernews" | "devto";
  sort_order: number;
  created_at?: string;
}

// =============================================================================
// Library
// =============================================================================

export type LibraryKind = "book" | "article" | "video" | "podcast" | "other";

/** `abandoned` is a real ending, not a failure to finish recording one. */
export type LibraryStatus = "want" | "in_progress" | "done" | "abandoned";

/** A book, article, video or podcast. Its status is the reading list. */
export interface LibrarySource {
  id: string;
  user_id?: string;
  kind: LibraryKind;
  title: string;
  /** Author, channel or host. */
  creator?: string | null;
  url?: string | null;
  status: LibraryStatus;
  rating?: number | null;
  notes?: string | null;
  started_on?: string | null;
  finished_on?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** A line worth keeping, usually from a source. Private until marked public. */
export interface LibraryHighlight {
  id: string;
  user_id?: string;
  /** Null when the source was deleted, or the line never had a record. */
  source_id?: string | null;
  text: string;
  /** For a line with no source record. */
  attribution?: string | null;
  /** "p. 42", "ch. 3", "12:34" — free text, since none of them is a number. */
  location?: string | null;
  note?: string | null;
  is_public: boolean;
  is_favorite: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * What a visitor receives: one public highlight and only the columns a
 * citation needs. Ratings, notes and statuses never reach this shape — the
 * database function behind it does not select them.
 */
export interface PublicHighlight {
  id: string;
  text: string;
  attribution: string | null;
  location: string | null;
  source_title: string | null;
  source_creator: string | null;
  source_kind: LibraryKind | null;
  source_url: string | null;
}
