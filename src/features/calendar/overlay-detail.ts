import type { CalendarEntry } from "@/types";

/**
 * What the sheet shows for a task, a habit roll-up or a day's money.
 *
 * These three are rendered on the calendar but owned by their own modules, so
 * the sheet is read-only for them. That was taken too literally: it showed the
 * date and nothing else, which is the one fact the grid had already told you.
 * Opening a habit summary should say *which* habits, and opening a day's money
 * should say how much moved.
 *
 * The database already returns all of it — `get_calendar_data` builds a JSON
 * payload per row — so this is purely a matter of reading what was sent. The
 * blob is unconstrained JSONB, so every field is validated on the way out
 * rather than trusted: a missing key means the row predates the column, not
 * that the caller may render `undefined`.
 */

export interface DetailRow {
  label: string;
  value: string;
}

export interface HabitDetail {
  title: string;
  /** A habit's own colour is a hex value it owns; the sheet only lists names. */
  color?: string | null;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Sentence-case a database enum for display: `in_progress` → `In progress`. */
function humanise(value: string): string {
  const spaced = value.replace(/[_-]+/g, " ").trim();
  if (!spaced) return value;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/** The habits completed that day, in the order the summary listed them. */
export function habitsFrom(entry: CalendarEntry): HabitDetail[] {
  const raw = entry.data?.habits;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): HabitDetail | null => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      const title = text(record.title);
      return title ? { title, color: text(record.color) } : null;
    })
    .filter((item): item is HabitDetail => item !== null);
}

/**
 * The labelled facts for an overlay entry.
 *
 * Returns only what is actually present. A row reading "Priority: —" tells you
 * less than no row at all, and four of them make a sheet look broken.
 */
export function detailRows(entry: CalendarEntry): DetailRow[] {
  const data = entry.data ?? {};
  const rows: DetailRow[] = [];

  if (entry.kind === "task") {
    const status = text(data.status);
    if (status) rows.push({ label: "Status", value: humanise(status) });

    const priority = text(data.priority);
    if (priority) rows.push({ label: "Priority", value: humanise(priority) });

    const estimate = num(data.estimate_minutes);
    if (estimate !== null && estimate > 0) {
      rows.push({ label: "Estimate", value: formatMinutes(estimate) });
    }
  }

  if (entry.kind === "habit_summary") {
    const count = num(data.count);
    if (count !== null) {
      rows.push({
        label: "Completed",
        value: count === 1 ? "1 habit" : `${count} habits`,
      });
    }
  }

  return rows;
}

/** `90` → `1h 30m`. Minutes alone stop being readable somewhere around 200. */
function formatMinutes(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole}m`;

  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * The money that moved, as the sheet states it.
 *
 * `earned` and `spent` are already in the base currency — the summary sums
 * `base_amount` — so no conversion happens here. Returned as numbers rather
 * than formatted strings so the caller can apply the user's currency.
 */
export function moneyFrom(entry: CalendarEntry): {
  count: number;
  earned: number;
  spent: number;
  net: number;
  /**
   * A projection from recurring rules rather than money that moved.
   *
   * The two must never be read as the same thing: one is a record and the
   * other is a guess about a day that has not happened. The flag is set by
   * `expectedMoneyDays`, and the sheet says which it is showing.
   */
  expected: boolean;
} | null {
  if (entry.kind !== "transaction_summary") return null;

  const data = entry.data ?? {};
  const earned = num(data.earned) ?? 0;
  const spent = num(data.spent) ?? 0;

  return {
    count: num(data.count) ?? 0,
    expected: data.expected === true,
    earned,
    spent,
    // Signed deliberately: a day that spent more than it earned should read as
    // negative rather than as a bare difference the reader has to interpret.
    net: earned - spent,
  };
}
