import type { CalendarEntry } from "@/types";

/**
 * Colour from a theme token, never a hex value.
 *
 * The previous module carried nine literals copied from Google Calendar's
 * palette. They looked right on exactly one theme and wrong on the other 51,
 * and the v3 rules forbid them for that reason.
 */
const TOKEN_CLASSES: Record<
  string,
  { bg: string; border: string; dot: string; ring: string; text: string }
> = {
  "chart-1": {
    bg: "bg-chart-1/15",
    border: "border-l-chart-1",
    dot: "bg-chart-1",
    ring: "border-chart-1/60",
    text: "text-chart-1",
  },
  "chart-2": {
    bg: "bg-chart-2/15",
    border: "border-l-chart-2",
    dot: "bg-chart-2",
    ring: "border-chart-2/60",
    text: "text-chart-2",
  },
  "chart-3": {
    bg: "bg-chart-3/15",
    border: "border-l-chart-3",
    dot: "bg-chart-3",
    ring: "border-chart-3/60",
    text: "text-chart-3",
  },
  "chart-4": {
    bg: "bg-chart-4/15",
    border: "border-l-chart-4",
    dot: "bg-chart-4",
    ring: "border-chart-4/60",
    text: "text-chart-4",
  },
  "chart-5": {
    bg: "bg-chart-5/15",
    border: "border-l-chart-5",
    dot: "bg-chart-5",
    ring: "border-chart-5/60",
    text: "text-chart-5",
  },
};

export function entryClasses(token: string | null | undefined) {
  return TOKEN_CLASSES[token ?? "chart-1"] ?? TOKEN_CLASSES["chart-1"];
}

/**
 * Whether an entry is a projection rather than a record.
 *
 * Money is the one kind that arrives both ways — what a day actually cost, from
 * the ledger, and what it is expected to cost, from the recurring rules. On the
 * grid they were the same chip in the same colour saying the same figure, which
 * is the one thing a forecast must never be allowed to do.
 *
 * Drawn outlined instead of filled: present, legible, and visibly not yet real.
 */
export const isExpected = (entry: CalendarEntry) =>
  entry.data?.expected === true;
