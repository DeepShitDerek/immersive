// Centralized Zod schemas for form validation

import { z } from "zod";
import {
  TASK_STATUS,
  TASK_PRIORITY,
  TASK_RECURRENCE,
  TASK_MINUTES_MAX,
  TASK_RECURRENCE_INTERVAL_MAX,
  LEARNING_STATUS,
  HABIT_VALUE_MAX,
} from "./constants";
import { SITE_IDENTITY_DEFAULTS } from "./site-identity-defaults";
import { CONTACT_TOPIC_VALUES } from "./contact-topics";
import { SITE_STYLES } from "./site-style";

// Re-exported for callers that already validate with this module.
export { CONTACT_TOPICS, contactTopicLabel } from "./contact-topics";

// =============================================================================
// LIMITS
//
// Postgres stores every text column here as unbounded TEXT, so these caps are
// not database constraints — they are the point past which a value stops being
// data and starts being a layout bug. Enforcing them here means one rule the
// forms, the tables, and the public renderers can all agree on.
// =============================================================================

const LIMITS = {
  /** Single-line labels: titles, names, categories, link text. */
  TITLE: 200,
  /** Short free text: excerpts, subtitles, descriptions shown in a card. */
  SUMMARY: 2_000,
  /** Long-form bodies: markdown content, notes, journals. */
  BODY: 100_000,
  /** A single tag. */
  TAG: 50,
  /** How many tags one record may carry. */
  TAG_COUNT: 20,
  /** URLs — well past any real URL, short of a denial-of-layout. */
  URL: 2_048,
} as const;

/**
 * The money ceiling mirrors its DB column width exactly. NUMERIC(10,2) tops out
 * at 99,999,999.99; anything larger is a Postgres `numeric field overflow`,
 * which surfaces to the user as an opaque failure after the form has already
 * told them the value was fine. The money module does not use it: it stores
 * integer minor units.
 */
const MONEY_MAX_10_2 = 99_999_999.99;

// =============================================================================
// REUSABLE SCHEMA FRAGMENTS
// =============================================================================

/** Optional string that can be null. */
const optionalString = z.string().optional().nullable();

/**
 * Optional free text with an upper bound. Kept nullable because every one of
 * these maps to a nullable TEXT column.
 */
const boundedOptionalString = (max: number, label = "This field") =>
  z
    .string()
    .max(max, `${label} must be ${max.toLocaleString()} characters or fewer`)
    .optional()
    .nullable();

/** Required single-line text with both a floor and a ceiling. */
const boundedRequiredString = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max.toLocaleString()} characters or fewer`);

/** URL or empty string validation. */
export const urlOrEmpty = z
  .string()
  .max(LIMITS.URL, "URL is too long")
  .url("Must be a valid URL")
  .or(z.literal(""));

/** A `#rrggbb` colour. Stored as TEXT, so nothing else validates it. */
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex colour such as #3b82f6");

/** URL-safe slug — matches the `^[a-z0-9-]+$` rule the blog editor enforces. */
const slug = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(LIMITS.TITLE, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens",
  );

/** A bounded list of bounded tags. */
const tagList = z
  .array(z.string().trim().max(LIMITS.TAG, "Tag is too long"))
  .max(LIMITS.TAG_COUNT, `At most ${LIMITS.TAG_COUNT} tags`)
  .optional()
  .nullable();

/**
 * An empty number input yields `""`, and `Number("")` is `0` — so a plain
 * `z.coerce.number().optional()` silently turns "I didn't fill this in" into a
 * real zero. For money and counts that is a data-integrity bug (an item of
 * unknown value becomes an item worth nothing), so blank is normalised to null
 * before coercion runs.
 */
const blankToNull = (value: unknown) =>
  value === "" || value === undefined ? null : value;

/**
 * Two decimal places, matching every NUMERIC(_, 2) column.
 *
 * Compares against the value rounded to 2dp rather than scaling by 100 —
 * `10.999 * 100` is `1099.9000000000001`, which rounds to the same integer as
 * a legitimate 2dp value and would let a third decimal through.
 */
const twoDecimals = (value: number) =>
  Number.isFinite(value) && Math.abs(value - Number(value.toFixed(2))) < 1e-9;

/** Money that may be absent, and is allowed to be zero when present. */
const optionalMoney = (max: number, label = "Amount") =>
  z.preprocess(
    blankToNull,
    z.coerce
      .number({ invalid_type_error: `${label} must be a number` })
      .min(0, `${label} cannot be negative`)
      .max(max, `${label} must be ${max.toLocaleString()} or less`)
      .refine(twoDecimals, `${label} can have at most 2 decimal places`)
      .nullable(),
  );

/** An optional whole number within a range; blank means "not set", not zero. */
const optionalInt = (min: number, max: number, label: string) =>
  z.preprocess(
    blankToNull,
    z.coerce
      .number({ invalid_type_error: `${label} must be a number` })
      .int(`${label} must be a whole number`)
      .min(min, `${label} must be between ${min} and ${max}`)
      .max(max, `${label} must be between ${min} and ${max}`)
      .nullable(),
  );

// =============================================================================
// TASK SCHEMAS
// =============================================================================

/**
 * Every bound here mirrors a CHECK constraint on `tasks` — see
 * `db/schema.sql`. A value this schema accepts and Postgres rejects surfaces as an opaque write failure.
 */
export const taskSchema = z
  .object({
    title: boundedRequiredString(LIMITS.TITLE, "Title"),
    description: boundedOptionalString(LIMITS.BODY, "Description"),
    project_id: z.string().uuid().optional().nullable(),
    status: z.enum([
      TASK_STATUS.TODO,
      TASK_STATUS.IN_PROGRESS,
      TASK_STATUS.REVIEW,
      TASK_STATUS.DONE,
    ]),
    priority: z.enum([
      TASK_PRIORITY.LOW,
      TASK_PRIORITY.MEDIUM,
      TASK_PRIORITY.HIGH,
    ]),
    start_date: optionalString,
    due_date: optionalString,
    tags: tagList,
    estimate_minutes: optionalInt(0, TASK_MINUTES_MAX, "Estimate"),
    recurrence: z
      .enum([
        TASK_RECURRENCE.DAILY,
        TASK_RECURRENCE.WEEKLY,
        TASK_RECURRENCE.MONTHLY,
      ])
      .optional()
      .nullable(),
    recurrence_interval: optionalInt(
      1,
      TASK_RECURRENCE_INTERVAL_MAX,
      "Repeat interval",
    ),
  })
  // Mirrors tasks_dates_ordered. A task ending before it starts renders as a
  // zero- or negative-width bar on the timeline.
  .refine(
    (data) =>
      !data.start_date ||
      !data.due_date ||
      new Date(String(data.start_date)) <= new Date(String(data.due_date)),
    {
      message: "Due date must be on or after the start date",
      path: ["due_date"],
    },
  )
  // Mirrors tasks_recurrence_needs_due_date. Without a due date there is no
  // anchor to advance, so the next instance would have no date at all.
  .refine((data) => !data.recurrence || !!data.due_date, {
    message: "A repeating task needs a due date to repeat from",
    path: ["due_date"],
  });

export type TaskFormValues = z.infer<typeof taskSchema>;

export const taskProjectSchema = z.object({
  name: boundedRequiredString(120, "Project name"),
  color: hexColor.optional().nullable(),
});

// =============================================================================
// HABIT SCHEMAS
// =============================================================================

/**
 * Every bound mirrors a CHECK constraint on `habits` — see
 * `db/schema.sql`.
 */
export const habitSchema = z
  .object({
    title: boundedRequiredString(LIMITS.TITLE, "Title"),
    color: hexColor,
    kind: z.enum(["build", "quit"]).default("build"),
    schedule: z
      .enum(["daily", "weekdays", "weekends", "custom", "weekly_count"])
      .default("daily"),
    schedule_days: z
      .array(z.number().int().min(1).max(7))
      .max(7)
      .optional()
      .nullable(),
    target_per_week: z.coerce
      .number()
      .int("Weekly target must be a whole number")
      .min(1, "Weekly target must be between 1 and 7")
      .max(7, "Weekly target must be between 1 and 7")
      .default(7),
    target_value: z.coerce
      .number()
      .positive("Target must be greater than zero")
      .max(HABIT_VALUE_MAX, "Target is too large")
      .default(1),
    unit: boundedOptionalString(24, "Unit"),
    step: z.coerce
      .number()
      .positive("Step must be greater than zero")
      .max(HABIT_VALUE_MAX, "Step is too large")
      .default(1),
    time_of_day: z
      .enum(["anytime", "morning", "afternoon", "evening"])
      .default("anytime"),
    category: boundedOptionalString(LIMITS.TITLE, "Category"),
    notes: boundedOptionalString(LIMITS.SUMMARY, "Notes"),
  })
  // Mirrors habits_custom_needs_days. A custom schedule with no days is due
  // never, which makes the habit impossible to complete and its streak
  // undefined.
  .refine(
    (data) =>
      data.schedule !== "custom" || (data.schedule_days?.length ?? 0) >= 1,
    {
      message: "Pick at least one day",
      path: ["schedule_days"],
    },
  )
  // A step larger than the target means one tap overshoots every time.
  .refine((data) => data.step <= data.target_value, {
    message: "Step cannot be larger than the target",
    path: ["step"],
  });

export type HabitFormValues = z.infer<typeof habitSchema>;

// =============================================================================
// LEARNING SCHEMAS
// =============================================================================

export const learningSubjectSchema = z.object({
  name: boundedRequiredString(LIMITS.TITLE, "Name"),
  description: boundedOptionalString(LIMITS.SUMMARY, "Description"),
});

export type LearningSubjectFormValues = z.infer<typeof learningSubjectSchema>;

const LEARNING_MATERIAL_KINDS = ["reference", "recall", "quiz"] as const;

export const learningTopicSchema = z.object({
  subject_id: z.string().min(1, "Subject is required"),
  title: boundedRequiredString(LIMITS.TITLE, "Title"),
  /**
   * Defaulted, matching the column default, so every form and every existing
   * row that never mentions a kind keeps behaving exactly as it did. A
   * required enum here would have made the field mandatory in a form that has
   * no control for it — which is a save that fails for a reason the writer
   * cannot see.
   */
  kind: z.enum(LEARNING_MATERIAL_KINDS).default("recall"),
  /**
   * 2000 mirrors `learning_topics_prompt_len` / `_answer_len`. A bound the
   * form accepts and the column rejects surfaces as an opaque write failure.
   */
  prompt: boundedOptionalString(2000, "Prompt"),
  answer: boundedOptionalString(2000, "Answer"),
  choices: z.array(boundedRequiredString(500, "Choice")).max(8).optional(),
  status: z.enum([
    LEARNING_STATUS.TO_LEARN,
    LEARNING_STATUS.LEARNING,
    LEARNING_STATUS.PRACTICING,
    LEARNING_STATUS.MASTERED,
  ]),
  core_notes: boundedOptionalString(LIMITS.BODY, "Notes"),
  /**
   * 1–5, matching `CHECK (confidence_score BETWEEN 1 AND 5)` on
   * `learning_topics`. This previously allowed 0–100, so any value the DB
   * would reject still passed client validation and failed on write with a
   * raw Postgres constraint error.
   */
  confidence_score: optionalInt(1, 5, "Confidence"),
  resources: z
    .array(
      z.object({
        name: boundedRequiredString(LIMITS.TITLE, "Resource name"),
        url: urlOrEmpty,
      }),
    )
    .max(50, "At most 50 resources")
    .optional()
    .nullable(),
});

// =============================================================================
// NOTE SCHEMAS
// =============================================================================

export const noteSchema = z.object({
  title: boundedOptionalString(LIMITS.TITLE, "Title"),
  content: boundedOptionalString(LIMITS.BODY, "Content"),
  tags: tagList,
  color: hexColor.optional().nullable(),
  is_pinned: z.boolean().optional(),
});

// =============================================================================
// LIFE UPDATE SCHEMAS
// =============================================================================

export const lifeUpdateSchema = z.object({
  title: boundedOptionalString(LIMITS.TITLE, "Title"),
  content: boundedOptionalString(LIMITS.BODY, "Content"),
  category: z
    .enum(["watching", "activity", "photo", "thought", "milestone"])
    .default("thought"),
  image_url: boundedOptionalString(LIMITS.URL, "Image URL"),
  tags: tagList,
  is_pinned: z.boolean().optional(),
  is_published: z.boolean().default(false),
});

// =============================================================================
// EVENT SCHEMAS
// =============================================================================

/**
 * Bounds taken from the `events` CHECK constraints, not chosen here.
 *
 * A value the form accepts and Postgres rejects surfaces as an opaque write
 * failure *after* the user has been told the input was fine — so these must
 * track `db/schema.sql`. The calendar rebuild added the columns below without
 * extending this schema, and the sheet was validating nothing but a non-empty
 * title, so a pasted address or a long meeting link failed at the database.
 */
const EVENT_LIMITS = {
  /** `char_length(location) <= 300` */
  LOCATION: 300,
  /** `char_length(meeting_url) <= 2048` */
  MEETING_URL: 2_048,
  /** `char_length(rrule) <= 500` */
  RRULE: 500,
  /** `travel_minutes BETWEEN 0 AND 1440` — a day. */
  TRAVEL_MINUTES: 1_440,
  /** `reminder_minutes BETWEEN 0 AND 40320` — four weeks. */
  REMINDER_MINUTES: 40_320,
} as const;

export const eventSchema = z
  .object({
    title: boundedRequiredString(LIMITS.TITLE, "Title"),
    description: boundedOptionalString(LIMITS.SUMMARY, "Description"),
    start_time: z.string().min(1, "Start time is required"),
    end_time: optionalString,
    is_all_day: z.boolean().optional(),
    location: boundedOptionalString(EVENT_LIMITS.LOCATION, "Location"),
    meeting_url: boundedOptionalString(
      EVENT_LIMITS.MEETING_URL,
      "Meeting link",
    ),
    rrule: boundedOptionalString(EVENT_LIMITS.RRULE, "Repeat rule"),
    calendar_id: z.string().uuid("Pick a real calendar").optional().nullable(),
    // Mirrors the column's CHECK exactly; a token outside this set renders
    // with no colour at all rather than falling back.
    color_token: z
      .enum(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"])
      .optional()
      .nullable(),
    status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
    travel_minutes: optionalInt(0, EVENT_LIMITS.TRAVEL_MINUTES, "Travel time"),
    reminder_minutes: optionalInt(0, EVENT_LIMITS.REMINDER_MINUTES, "Reminder"),
    task_id: z.string().uuid().optional().nullable(),
  })
  // An event ending before it starts renders as a zero/negative-width block and
  // breaks the calendar's day grouping.
  .refine((v) => !v.end_time || v.end_time >= v.start_time, {
    message: "End time must be after the start time",
    path: ["end_time"],
  });

/**
 * A calendar. `name` is bounded 1..80 by the column, and the sidebar checked
 * only that it was non-empty — so a long name failed at the database with
 * nothing to tell the user which field was at fault.
 */
export const CALENDAR_LIMITS = {
  /** `char_length(name) BETWEEN 1 AND 80` */
  NAME: 80,
  /** `char_length(home_timezone) <= 64` on calendar_settings. */
  TIMEZONE: 64,
} as const;

export const calendarSchema = z.object({
  name: boundedRequiredString(CALENDAR_LIMITS.NAME, "Calendar name"),
  color_token: z.enum(["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"]),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// =============================================================================
// INVENTORY SCHEMAS
// =============================================================================

/**
 * Bounds mirror the CHECK constraints in
 * `db/schema.sql`.
 */
export const inventoryItemSchema = z
  .object({
    name: boundedRequiredString(LIMITS.TITLE, "Name"),
    category: boundedRequiredString(LIMITS.TITLE, "Category"),
    location: boundedOptionalString(120, "Location"),
    quantity: z.coerce
      .number()
      .int("Quantity must be a whole number")
      .min(1, "Quantity must be at least 1")
      .max(100000, "Quantity is too large")
      .default(1),
    serial_number: boundedOptionalString(LIMITS.TITLE, "Serial number"),
    tags: tagList,
    purchase_date: optionalString,
    warranty_expiry: optionalString,
    purchase_price: z.coerce
      .number()
      .min(0, "Price must be non-negative")
      .max(MONEY_MAX_10_2, "Price is too large"),
    // Left blank means "not appraised" — distinct from a value of zero.
    current_value: optionalMoney(MONEY_MAX_10_2, "Current value"),
    image_url: boundedOptionalString(LIMITS.URL, "Image URL"),
    notes: boundedOptionalString(LIMITS.BODY, "Notes"),
  })
  // Mirrors inventory_warranty_after_purchase. A warranty that ends before the
  // thing was bought is a typo, and the database rejects it either way.
  .refine(
    (data) =>
      !data.purchase_date ||
      !data.warranty_expiry ||
      new Date(String(data.warranty_expiry)) >=
        new Date(String(data.purchase_date)),
    {
      message: "Warranty cannot end before the purchase date",
      path: ["warranty_expiry"],
    },
  );

export type InventoryItemFormValues = z.infer<typeof inventoryItemSchema>;

// =============================================================================
// PORTFOLIO & CONTENT SCHEMAS
// =============================================================================

export const portfolioSectionSchema = z.object({
  title: boundedRequiredString(LIMITS.TITLE, "Title"),
  type: z.enum(["markdown", "list_items", "gallery"]),
  content: boundedOptionalString(LIMITS.BODY, "Content"),
  page_path: z
    .string()
    .trim()
    .min(1, "Page path is required")
    .max(LIMITS.TITLE, "Page path is too long")
    // The catch-all route builds its static params from these, so a path that
    // isn't root-relative produces a page that can never be reached.
    .regex(/^\//, "Page path must start with /"),
  layout_style: z.string().default("default"),
  is_visible: z.boolean().default(true),
  show_title: z.boolean().default(true),
});

export type PortfolioSectionFormValues = z.infer<typeof portfolioSectionSchema>;

export const portfolioItemSchema = z.object({
  section_id: z.string().min(1, "Section is required"),
  title: boundedRequiredString(LIMITS.TITLE, "Title"),
  subtitle: boundedOptionalString(LIMITS.TITLE, "Subtitle"),
  date_from: optionalString,
  date_to: optionalString,
  description: boundedOptionalString(LIMITS.BODY, "Description"),
  image_url: boundedOptionalString(LIMITS.URL, "Image URL"),
  link_url: boundedOptionalString(LIMITS.URL, "Link URL"),
  tags: tagList,
  internal_notes: boundedOptionalString(LIMITS.SUMMARY, "Internal notes"),
  /**
   * The item this one fed into, for the timeline layout.
   *
   * Nullable and unvalidated beyond being a string: the database holds the
   * foreign key and a trigger rejects loops, which is the right place for both
   * — the client can only prevent the cycles it thinks of.
   */
  merged_into_id: z.string().nullable().optional(),
  /** Mirrors `portfolio_items_slug_check`; 'view' is the fallback route. */
  slug: z
    .string()
    .max(80, "Page address must be 80 characters or fewer")
    .regex(
      /^[a-z0-9]+(-[a-z0-9]+)*$/,
      "Page address: lower-case letters, numbers and single hyphens",
    )
    .refine((slug) => slug !== "view", "“view” is reserved")
    .nullable()
    .optional(),
  case_study: z
    .string()
    .max(200_000, "Case study must be 200,000 characters or fewer")
    .nullable()
    .optional(),
});

export const navLinkSchema = z.object({
  label: boundedRequiredString(LIMITS.TITLE, "Label"),
  /**
   * Internal paths only. `[...slug]/generateStaticParams` turns every nav href
   * into a prerendered route by stripping the leading slash, so an absolute URL
   * such as `https://example.com` produced the static path
   * `https:/​/example.com` — a broken page that the build still emitted.
   */
  href: z
    .string()
    .trim()
    .min(1, "Path is required")
    .max(LIMITS.URL, "Path is too long")
    .regex(/^\/[^\s]*$/, "Must be a site path starting with / (e.g. /about)"),
  display_order: z.coerce
    .number()
    .int("Display order must be a whole number")
    .default(0),
  is_visible: z.boolean().default(true),
});

// =============================================================================
// BLOG SCHEMAS
// =============================================================================

export const blogPostSchema = z.object({
  title: boundedRequiredString(LIMITS.TITLE, "Title"),
  // The slug is the public URL and is UNIQUE in the database; the editor
  // already enforced this shape locally, so it belongs in the shared contract.
  slug,
  excerpt: boundedOptionalString(LIMITS.SUMMARY, "Excerpt"),
  content: boundedOptionalString(LIMITS.BODY, "Content"),
  cover_image_url: boundedOptionalString(LIMITS.URL, "Cover image URL"),
  published: z.boolean().default(false),
  published_at: optionalString,
  show_toc: z.boolean().default(true),
  tags: tagList,
  internal_notes: boundedOptionalString(LIMITS.SUMMARY, "Internal notes"),
});

// =============================================================================
// CONTACT FORM SCHEMA
// =============================================================================

/**
 * The one form an unauthenticated visitor can write to the database from.
 *
 * Every field had a floor and no ceiling, and the columns are TEXT, so a
 * visitor could insert a row of any size — and the INSERT policy is
 * `WITH CHECK (true)`. These bounds are mirrored by a CHECK constraint in
 * `db/schema.sql`; the database copy is the one that holds when the request
 * does not come from this form at all.
 */
export const CONTACT_LIMITS = {
  NAME: 200,
  /** RFC 5321 caps an address at 320 characters. */
  EMAIL: 320,
  SUBJECT: 200,
  MESSAGE: 5_000,
} as const;

export const contactFormSchema = z.object({
  topic: z.enum(CONTACT_TOPIC_VALUES, {
    errorMap: () => ({ message: "Choose what this is about" }),
  }),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(CONTACT_LIMITS.NAME, "Name is too long"),
  email: z
    .string()
    .trim()
    .max(CONTACT_LIMITS.EMAIL, "Email is too long")
    .email("Please enter a valid email address"),
  subject: z
    .string()
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(CONTACT_LIMITS.SUBJECT, "Subject is too long"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(
      CONTACT_LIMITS.MESSAGE,
      `Message must be ${CONTACT_LIMITS.MESSAGE.toLocaleString()} characters or fewer`,
    ),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

// =============================================================================
// SITE SETTINGS SCHEMAS
// =============================================================================

const socialLinkSchema = z.object({
  // Doubles as the lookup key into SOCIAL_ICONS and as the React key, so a
  // blank id would collapse two rows onto one another in the editor.
  id: boundedRequiredString(LIMITS.TAG, "Link id"),
  label: boundedRequiredString(LIMITS.TITLE, "Label"),
  // `mailto:`/`tel:` are legitimate here (the "email" link is one), and z.url()
  // accepts them, but the public renderer runs every one through safeLinkUrl.
  url: urlOrEmpty,
  is_visible: z.boolean(),
});

/**
 * How many entries each open-ended list may hold.
 *
 * These used to be implicit and wrong in both directions: `bio` and
 * `currently_exploring.items` were capped at exactly two by the number of
 * inputs the form drew (`BIO_SLOTS`, `EXPLORING_SLOTS`), which is form layout
 * deciding content shape, while the arrays themselves had no ceiling at all in
 * the schema. Now the ceiling is in the contract and the form draws whatever
 * the contract allows.
 */
export const SITE_LIST_LIMITS = {
  BIO_PARAGRAPHS: 6,
  EXPLORING_ITEMS: 8,
  SOCIAL_LINKS: 12,
  /** The hero's results strip reads as a row; four is a row. */
  PROOF_POINTS: 4,
} as const;

/**
 * A list of short strings that drops blanks on the way through.
 *
 * The editor keeps an empty row while you are typing into it; persisting that
 * row would render an empty paragraph or an empty bullet on the public site.
 */
const trimmedList = (max: number, count: number, label: string) =>
  z
    .array(z.string().max(max, `${label} is too long`))
    .max(count, `At most ${count} ${label.toLowerCase()} entries`)
    .transform((items) => items.filter((item) => item.trim() !== ""));

export const siteSettingsSchema = z.object({
  portfolio_mode: z.enum(["multi-page", "single-page"]),
  profile_data: z.object({
    name: boundedRequiredString(LIMITS.TITLE, "Name"),
    title: boundedRequiredString(LIMITS.TITLE, "Title"),
    default_theme: boundedRequiredString(LIMITS.TAG, "Theme"),
    // Fed to hexToHsl() and written straight into CSS custom properties, so a
    // malformed value here silently blanks out the whole custom theme.
    custom_theme_colors: z
      .object({
        background: hexColor.default("#0f172a"),
        foreground: hexColor.default("#e2e8f0"),
        primary: hexColor.default("#0ea5e9"),
        secondary: hexColor.default("#1e293b"),
        accent: hexColor.default("#38bdf8"),
        card: hexColor.default("#1e293b"),
      })
      .optional(),
    description: boundedRequiredString(LIMITS.SUMMARY, "Hero description"),
    headline: z.string().max(LIMITS.TITLE, "Headline is too long").default(""),
    proof: z
      .array(
        z.object({
          value: z
            .string()
            .trim()
            .min(1, "Add the figure")
            .max(24, "Keep the figure to 24 characters"),
          label: z
            .string()
            .trim()
            .min(1, "Say what the figure measures")
            .max(LIMITS.TITLE, "Label is too long"),
        }),
      )
      .max(
        SITE_LIST_LIMITS.PROOF_POINTS,
        `At most ${SITE_LIST_LIMITS.PROOF_POINTS} results`,
      )
      .default([]),
    profile_picture_url: urlOrEmpty,
    show_profile_picture: z.boolean(),
    // Optional because a fresh install has neither, and a required field in one
    // group must not be what stops an unrelated group from saving.
    logo: z.object({
      main: z.string().max(LIMITS.TITLE, "Logo text is too long"),
      highlight: z.string().max(LIMITS.TITLE, "Logo highlight is too long"),
    }),
    bio: trimmedList(LIMITS.BODY, SITE_LIST_LIMITS.BIO_PARAGRAPHS, "Bio"),
    status_panel: z.object({
      show: z.boolean().default(true),
      design: z.enum(["minimal", "terminal", "bento"]).default("minimal"),
      title: z.string().max(LIMITS.TITLE, "Panel title is too long"),
      availability: z
        .string()
        .max(LIMITS.TITLE, "Availability text is too long"),
      currently_exploring: z.object({
        title: z.string().max(LIMITS.TITLE, "Heading is too long"),
        items: trimmedList(
          LIMITS.TITLE,
          SITE_LIST_LIMITS.EXPLORING_ITEMS,
          "Exploring",
        ),
      }),
      latestProject: z.object({
        name: z.string().max(LIMITS.TITLE, "Project name is too long"),
        linkText: z.string().max(LIMITS.TITLE, "Link text is too long"),
        // A path such as "/work", not an absolute URL — safeLinkUrl allows
        // both and the renderer decides whether to open a new tab.
        href: z.string().max(LIMITS.URL, "Project URL is too long"),
      }),
    }),
    github_projects_config: z
      .object({
        username: z.string().max(LIMITS.TITLE, "Username is too long"),
        show: z.boolean(),
        sort_by: z.enum(["pushed", "created", "updated"]),
        exclude_forks: z.boolean(),
        exclude_archived: z.boolean(),
        exclude_profile_repo: z.boolean(),
        min_stars: z.coerce.number().int().min(0, "Cannot be negative."),
        projects_per_page: z.coerce
          .number()
          .int()
          .min(1, "Must be at least 1.")
          .max(100, "Max is 100."),
      })
      // Required only when the section is switched on. Demanding a username
      // from someone who has turned GitHub off is how one group's field ends
      // up blocking every other group's save.
      .superRefine((config, ctx) => {
        if (config.show && config.username.trim() === "") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["username"],
            message: "GitHub username is required while the section is shown.",
          });
        }
      }),
    contact_page: z.object({
      show_contact_form: z.boolean().default(true),
      show_availability_badge: z.boolean().default(true),
      show_services: z.boolean().default(true),
    }),
    updates_layout: z.enum(["timeline", "scrapbook"]).default("scrapbook"),
    typography_preset: boundedRequiredString(LIMITS.TAG, "Typography preset"),
    site_style: z.enum(SITE_STYLES).optional(),
  }),
  social_links: z
    .array(socialLinkSchema)
    .max(
      SITE_LIST_LIMITS.SOCIAL_LINKS,
      `At most ${SITE_LIST_LIMITS.SOCIAL_LINKS} social links`,
    )
    .superRefine((links, ctx) => {
      const seen = new Set<string>();
      links.forEach((link, index) => {
        const key = link.id.trim().toLowerCase();
        if (seen.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "id"],
            message: "Each link needs its own id.",
          });
        }
        seen.add(key);
      });
    }),
  footer_data: z.object({
    copyright_text: z
      .string()
      .max(LIMITS.SUMMARY, "Copyright text is too long"),
  }),
});

export type SiteSettingsFormValues = z.infer<typeof siteSettingsSchema>;

/** Default values for site settings form */
/**
 * Default values for site settings.
 *
 * The literal lives in `site-identity-defaults.ts` so the public data layer can
 * reuse it without pulling Zod into every route's first load. Annotating it
 * here still type-checks it against the schema.
 */
export const siteSettingsDefaultValues: SiteSettingsFormValues =
  SITE_IDENTITY_DEFAULTS as unknown as SiteSettingsFormValues;

// =============================================================================
// DISCOVER SCHEMAS
// =============================================================================

/**
 * Bounds from the `discover_places` and `discover_topics` CHECK constraints.
 *
 * The coordinate ranges are the interesting ones: a typed longitude of 720 is
 * not a place, and without this it reaches Postgres as a constraint violation
 * the form cannot explain.
 */
const DISCOVER_LIMITS = {
  /** `char_length(label) BETWEEN 1 AND 80` */
  PLACE_LABEL: 80,
  /** `char_length(term) BETWEEN 1 AND 80` */
  TOPIC_TERM: 80,
  /** `char_length(timezone) <= 64` */
  TIMEZONE: 64,
} as const;

export const discoverPlaceSchema = z.object({
  label: boundedRequiredString(DISCOVER_LIMITS.PLACE_LABEL, "Name"),
  latitude: z
    .number({ invalid_type_error: "Latitude must be a number" })
    .finite("Latitude must be a number")
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  longitude: z
    .number({ invalid_type_error: "Longitude must be a number" })
    .finite("Longitude must be a number")
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  timezone: boundedOptionalString(DISCOVER_LIMITS.TIMEZONE, "Timezone"),
  sort_order: z.number().int().optional(),
});

export const discoverTopicSchema = z.object({
  term: boundedRequiredString(DISCOVER_LIMITS.TOPIC_TERM, "Topic"),
  // Mirrors the column's CHECK exactly. A source the app cannot fetch would
  // render a panel that never fills.
  source: z.enum(["hackernews", "devto"]),
  sort_order: z.number().int().optional(),
});

// ─── Library ──────────────────────────────────────────────────────────────

export const LIBRARY_KINDS = [
  "book",
  "article",
  "video",
  "podcast",
  "other",
] as const;

export const LIBRARY_STATUSES = [
  "want",
  "in_progress",
  "done",
  "abandoned",
] as const;

/** Mirrors the CHECK constraints in db/schema.sql. */
const LIBRARY_LIMITS = {
  TITLE: 200,
  CREATOR: 200,
  URL: 2_048,
  NOTES: 2_000,
  TEXT: 2_000,
  ATTRIBUTION: 200,
  LOCATION: 50,
} as const;

export const librarySourceSchema = z
  .object({
    kind: z.enum(LIBRARY_KINDS),
    title: boundedRequiredString(LIBRARY_LIMITS.TITLE, "Title"),
    creator: boundedOptionalString(LIBRARY_LIMITS.CREATOR, "Author"),
    /**
     * A web link only. It is rendered as a citation link on the public site,
     * so a `javascript:` value must never get as far as the database.
     */
    url: boundedOptionalString(LIBRARY_LIMITS.URL, "Link").refine(
      (value) => !value || /^https?:\/\/\S+$/i.test(value.trim()),
      "Use a full link starting with https://",
    ),
    status: z.enum(LIBRARY_STATUSES),
    rating: optionalInt(1, 5, "Rating"),
    notes: boundedOptionalString(LIBRARY_LIMITS.NOTES, "Notes"),
    started_on: optionalString,
    finished_on: optionalString,
  })
  .superRefine((value, ctx) => {
    // Mirrors `library_sources_dates_ordered`, so the form says it rather than
    // the database refusing it opaquely.
    if (
      value.started_on &&
      value.finished_on &&
      value.finished_on < value.started_on
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["finished_on"],
        message: "Finished before it was started",
      });
    }
  });

export type LibrarySourceFormValues = z.infer<typeof librarySourceSchema>;

export const libraryHighlightSchema = z.object({
  source_id: z.string().nullable().optional(),
  text: boundedRequiredString(LIBRARY_LIMITS.TEXT, "The line"),
  attribution: boundedOptionalString(LIBRARY_LIMITS.ATTRIBUTION, "Attribution"),
  location: boundedOptionalString(LIBRARY_LIMITS.LOCATION, "Where"),
  note: boundedOptionalString(LIBRARY_LIMITS.NOTES, "Note"),
  is_public: z.boolean(),
  is_favorite: z.boolean(),
});

export type LibraryHighlightFormValues = z.infer<typeof libraryHighlightSchema>;
