import type { LearningTopic } from "@/types";

/**
 * Spaced review scheduling.
 *
 * The module used to ask you to rate your own "confidence" from 1 to 5 and set
 * a status by hand. Self-rating is unreliable, it is one more form to fill in,
 * and — worst of all — nothing ever acted on it. A topic marked "Mastered" was
 * never seen again, so everything learned decayed silently.
 *
 * A review rating does three jobs at once: it is a single tap, it is a real
 * signal because it follows an attempt to recall, and it schedules the next
 * review. The tool answers "what should I study today?" instead of asking.
 *
 * `record_learning_review` in the database is authoritative — these functions
 * mirror it so the UI can say "next in 6 days" before you commit to the rating,
 * and so the arithmetic is testable without a round trip.
 */

export type ReviewRating = "again" | "hard" | "good" | "easy";

export const REVIEW_RATINGS: {
  value: ReviewRating;
  label: string;
  hint: string;
}[] = [
  { value: "again", label: "Again", hint: "Couldn't recall it" },
  { value: "hard", label: "Hard", hint: "Recalled with effort" },
  { value: "good", label: "Good", hint: "Recalled it" },
  { value: "easy", label: "Easy", hint: "Instant" },
];

const EASE_MIN = 1.3;
const EASE_MAX = 3.5;
const INTERVAL_MAX = 3650;

interface ReviewState {
  ease: number;
  intervalDays: number;
  lapses: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The state a rating produces. Mirrors `record_learning_review`.
 *
 * "Again" resets to tomorrow rather than to zero: a topic you just failed to
 * recall is exactly the one worth seeing soon, and burying it deeper is how
 * material gets abandoned.
 */
function applyRating(state: ReviewState, rating: ReviewRating): ReviewState {
  const ease = state.ease || 2.5;
  const interval = state.intervalDays ?? 0;

  switch (rating) {
    case "again":
      return {
        ease: clamp(ease - 0.2, EASE_MIN, EASE_MAX),
        intervalDays: 1,
        lapses: state.lapses + 1,
      };
    case "hard":
      return {
        ease: clamp(ease - 0.15, EASE_MIN, EASE_MAX),
        intervalDays: clamp(
          Math.ceil(Math.max(interval, 1) * 1.2),
          1,
          INTERVAL_MAX,
        ),
        lapses: state.lapses,
      };
    case "good":
      return {
        ease,
        intervalDays: clamp(
          interval === 0 ? 1 : interval === 1 ? 3 : Math.ceil(interval * ease),
          1,
          INTERVAL_MAX,
        ),
        lapses: state.lapses,
      };
    case "easy": {
      const nextEase = clamp(ease + 0.15, EASE_MIN, EASE_MAX);
      return {
        ease: nextEase,
        intervalDays: clamp(
          interval === 0
            ? 4
            : Math.ceil(Math.max(interval, 1) * nextEase * 1.3),
          1,
          INTERVAL_MAX,
        ),
        lapses: state.lapses,
      };
    }
  }
}

function stateOf(topic: LearningTopic): ReviewState {
  return {
    ease: topic.ease ?? 2.5,
    intervalDays: topic.interval_days ?? 0,
    lapses: topic.lapses ?? 0,
  };
}

/** "Tomorrow", "in 6 days", "in 2 months" — shown on the rating button. */
export function describeInterval(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  if (months < 12) return `in ${months} month${months === 1 ? "" : "s"}`;
  const years = Math.round(days / 365);
  return `in ${years} year${years === 1 ? "" : "s"}`;
}

/** What each rating would schedule, for the buttons. */
export function previewIntervals(
  topic: LearningTopic,
): Record<ReviewRating, number> {
  const state = stateOf(topic);
  return {
    again: applyRating(state, "again").intervalDays,
    hard: applyRating(state, "hard").intervalDays,
    good: applyRating(state, "good").intervalDays,
    easy: applyRating(state, "easy").intervalDays,
  };
}

/** Local calendar day as `YYYY-MM-DD`. */
export function todayIso(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isNew(topic: LearningTopic): boolean {
  return !topic.last_reviewed_at;
}

export function isDue(topic: LearningTopic, today = todayIso()): boolean {
  if (topic.archived_at) return false;
  if (isNew(topic)) return false;
  return !!topic.due_date && topic.due_date <= today;
}

/**
 * The day's queue.
 *
 * Two rules exist purely to stop the tool becoming a source of guilt:
 *
 * - It is capped. An unbounded backlog after a fortnight away is the single
 *   most reliable way to make someone close a study app and not reopen it. The
 *   rest is not lost, it simply is not shown today.
 * - New topics are limited per day. Adding twenty topics in an evening of
 *   enthusiastic planning should not produce twenty reviews tomorrow and a
 *   compounding wall for the rest of the month.
 *
 * Most-overdue first, so the material closest to being forgotten comes back
 * before the material that is merely due.
 */
export function buildQueue(
  topics: LearningTopic[],
  options: { today?: string; maxReviews?: number; maxNew?: number } = {},
): { due: LearningTopic[]; fresh: LearningTopic[]; deferred: number } {
  const today = options.today ?? todayIso();
  const maxReviews = options.maxReviews ?? 20;
  const maxNew = options.maxNew ?? 5;

  /**
   * Reference material never enters the queue.
   *
   * Being asked to "recall" a page of explanation is what made the module feel
   * like it only did flashcards: the material you need to *read* was in the
   * same pile as the material you are meant to have memorised, so it either
   * cluttered the queue or you did not write it down at all. Reading is a
   * different act from recalling, and only one of them is scheduled.
   */
  const active = topics.filter(
    (t) => !t.archived_at && (t.kind ?? "recall") !== "reference",
  );

  const allDue = active
    .filter((t) => isDue(t, today))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  const allNew = active
    .filter(isNew)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

  const due = allDue.slice(0, maxReviews);
  const fresh = allNew.slice(0, maxNew);

  return {
    due,
    fresh,
    deferred: allDue.length - due.length + (allNew.length - fresh.length),
  };
}

/**
 * How many days late a review is. Zero when due today or new.
 *
 * Used only to order the queue and to soften the wording — never to shame.
 */
export function daysOverdue(topic: LearningTopic, today = todayIso()): number {
  if (!topic.due_date || isNew(topic)) return 0;
  const [dy, dm, dd] = topic.due_date.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const diff = Date.UTC(ty, tm - 1, td) - Date.UTC(dy, dm - 1, dd);
  return Math.max(0, Math.round(diff / 86400000));
}

/**
 * Retention: reviews you recalled, over reviews you attempted.
 *
 * This is the number worth watching. Hours studied rewards sitting still;
 * this rewards remembering, which is the actual goal.
 */
export function retentionRate(
  reviews: { rating: ReviewRating }[],
): number | null {
  if (reviews.length === 0) return null;
  const recalled = reviews.filter((r) => r.rating !== "again").length;
  return Math.round((recalled / reviews.length) * 100);
}

export interface WeakArea {
  topic: LearningTopic;
  /** Times this has been forgotten after being learned. */
  lapses: number;
  /** How hard the algorithm now thinks it is. Lower is harder. */
  ease: number;
}

/**
 * What keeps slipping.
 *
 * The module recorded `lapses` and `ease` from the first migration and never
 * showed either, so the one question a study tool should be able to answer —
 * "what am I bad at?" — had no screen. Both are already the honest signal: a
 * lapse is a topic you had learned and then could not recall, and ease falls
 * every time that happens.
 *
 * Ordered by lapses and then by difficulty, and deliberately capped: a list of
 * everything you are bad at is a list nobody opens twice.
 */
export function weakAreas(topics: LearningTopic[], limit = 5): WeakArea[] {
  return topics
    .filter((topic) => !topic.archived_at && (topic.lapses ?? 0) > 0)
    .map((topic) => ({
      topic,
      lapses: topic.lapses ?? 0,
      // 2.5 is the schema default, i.e. "no opinion yet".
      ease: topic.ease ?? 2.5,
    }))
    .sort((a, b) => b.lapses - a.lapses || a.ease - b.ease)
    .slice(0, limit);
}

/**
 * Whether a topic can be marked right or wrong rather than self-rated.
 *
 * Self-rating how well you remembered is not the same as being marked, and
 * certification practice needs the second one. A quiz topic with no stored
 * answer cannot be marked, so it falls back to self-rating rather than
 * pretending to grade.
 */
export function isMarkable(topic: LearningTopic): boolean {
  return (topic.kind ?? "recall") === "quiz" && Boolean(topic.answer?.trim());
}

/** The question to ask. Falls back to the title, which is what it was before. */
export function promptFor(topic: LearningTopic): string {
  return topic.prompt?.trim() || topic.title;
}
