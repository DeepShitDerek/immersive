"use client";

import { AlertTriangle, EyeOff } from "lucide-react";
import type { CalendarEntry, CalendarRow } from "@/types";
import { getErrorMessage } from "@/lib/utils";

/**
 * Why the grid is empty, when it is.
 *
 * A calendar that fetched nothing and a calendar whose query *failed* used to
 * look identical: `useGetCalendarDataQuery` was destructured for `data` and
 * `isLoading` and not for `error`, so a raising RPC fell back to `rows = []`
 * and drew a blank week in silence. Every explanation for "I can't see
 * anything" — the overlays being off, the calendars being hidden, the range
 * genuinely being quiet, the function being broken — arrived as the same empty
 * grid.
 *
 * So this says which. It is a strip above the grid rather than a replacement
 * for it: the grid is still the thing you came for, and a week with one event
 * and three hidden overlays should show that event *and* say what is missing.
 *
 * The distinction that matters most is the first: **rows arrived but nothing
 * is drawn**. That is never a quiet week — it is a filter, and the filter is
 * one the owner can reach.
 */

export interface GridStatusProps {
  error: unknown;
  /** What the query returned, before any client-side filtering. */
  rows: CalendarRow[];
  /** What survived filtering, and would be drawn. */
  entries: CalendarEntry[];
  hiddenCalendarCount: number;
  overlays: { tasks: boolean; habits: boolean; finance: boolean };
}

/** Kinds the overlay switches control, with the switch that hides each. */
const OVERLAY_OF: Record<string, keyof GridStatusProps["overlays"]> = {
  task: "tasks",
  habit_summary: "habits",
  transaction_summary: "finance",
};

const LABEL_OF: Record<keyof GridStatusProps["overlays"], string> = {
  tasks: "Tasks",
  habits: "Habits",
  finance: "Money",
};

export function GridStatus({
  error,
  rows,
  entries,
  hiddenCalendarCount,
  overlays,
}: GridStatusProps) {
  if (error) {
    return (
      <p className="flex items-start gap-2.5 rounded-surface bg-destructive/10 p-3 text-sm">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <span className="text-foreground">
          The calendar could not be loaded, so this grid is empty rather than
          quiet. {getErrorMessage(error)}
        </span>
      </p>
    );
  }

  if (entries.length > 0) return null;

  /*
    Rows came back and none of them survived. Name what is hiding them, and
    how many — "3 tasks are hidden" is actionable in a way that a blank grid
    and a checkbox in a closed panel are not.
  */
  const hiddenByOverlay = new Map<keyof GridStatusProps["overlays"], number>();
  let hiddenByCalendar = 0;

  for (const row of rows) {
    const overlay = OVERLAY_OF[row.item_type];
    if (overlay) {
      if (!overlays[overlay]) {
        hiddenByOverlay.set(overlay, (hiddenByOverlay.get(overlay) ?? 0) + 1);
      }
      continue;
    }
    if (hiddenCalendarCount > 0) hiddenByCalendar += 1;
  }

  const parts = Array.from(hiddenByOverlay.entries()).map(
    ([overlay, count]) => `${count} ${LABEL_OF[overlay].toLowerCase()}`,
  );

  if (parts.length === 0 && hiddenByCalendar === 0) {
    return (
      <p className="rounded-surface bg-secondary/50 p-3 text-sm text-muted-foreground">
        Nothing in this range.
      </p>
    );
  }

  return (
    <p className="flex items-start gap-2.5 rounded-surface bg-secondary/50 p-3 text-sm">
      <EyeOff
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="text-foreground">
        Nothing is drawn, but this range is not empty:{" "}
        {parts.length > 0 && (
          <>{parts.join(", ")} hidden by the overlay chips</>
        )}
        {parts.length > 0 && hiddenByCalendar > 0 && ", and "}
        {hiddenByCalendar > 0 && (
          <>
            {hiddenByCalendar} event{hiddenByCalendar === 1 ? "" : "s"} on
            calendars you have unticked
          </>
        )}
        .
      </span>
    </p>
  );
}
