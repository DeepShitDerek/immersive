"use client";

import { useMemo } from "react";
import { addDays, format } from "date-fns";
import { toast } from "sonner";
import type { CalendarEntry, CalendarRow, Task } from "@/types";
import {
  useAddEventMutation,
  useGetCalendarDataQuery,
  useGetCalendarSettingsQuery,
  useGetCalendarsQuery,
  useGetEventExceptionsQuery,
  useGetTasksQuery,
  useSaveCalendarSettingsMutation,
  useSaveEventExceptionMutation,
  useUpdateEventMutation,
} from "@/store/api/adminApi";
import {
  useGetAccountsQuery,
  useGetSchedulesQuery,
  useGetSkipsQuery,
} from "@/features/money/data/money-api";
import { expectedMoneyDays, majorUnits } from "@/features/money/calendar-feed";
import { useChoice } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import { buildEntries, filterEntries } from "./build-entries";
import { withCalendarColors } from "./entry-color";

/** A task dragged in without an estimate gets an hour. */
const DEFAULT_BLOCK_MINUTES = 60;

const NO_ROWS: CalendarRow[] = [];
const NO_TASKS: Task[] = [];
const NO_LIST: never[] = [];
const iso = (date: Date) => format(date, "yyyy-MM-dd");

/**
 * The series' new start and end when one occurrence moves to [start, end)
 * and the change is meant for the whole series.
 *
 * The series' own first start shifts by the same amount the occurrence
 * moved. Writing the occurrence's date as the series start (what this used
 * to do) restarted the series there and dropped every earlier occurrence.
 */
export function shiftSeries(
  entry: Pick<CalendarEntry, "start" | "occurrenceStart" | "seriesStart">,
  start: Date,
  end: Date,
): { start: Date; end: Date } {
  const from = entry.occurrenceStart ?? entry.start;
  const shift = start.getTime() - from.getTime();
  const base = entry.seriesStart ?? from;
  const seriesStart = new Date(base.getTime() + shift);
  return {
    start: seriesStart,
    end: new Date(seriesStart.getTime() + (end.getTime() - start.getTime())),
  };
}

/**
 * Everything the calendar reads and writes, for the days on screen.
 *
 * The views only ever see `entries` (already expanded, filtered and
 * coloured) and call the actions here; none of them knows a table name.
 */
export function useCalendarData({ from, to }: { from: Date; to: Date }) {
  const { data: settings } = useGetCalendarSettingsQuery();
  const [saveSettings] = useSaveCalendarSettingsMutation();
  const { data: calendars = NO_LIST } = useGetCalendarsQuery();
  const { data: exceptions = NO_LIST } = useGetEventExceptionsQuery();
  const { data: tasks = NO_TASKS } = useGetTasksQuery();
  // The forecast half of the money overlay: what is due, not only what was.
  const { data: schedules = NO_LIST } = useGetSchedulesQuery();
  const { data: skipKeys = NO_LIST } = useGetSkipsQuery();
  const { data: moneyAccounts = NO_LIST } = useGetAccountsQuery();
  const {
    data: rows = NO_ROWS,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetCalendarDataQuery({ start: iso(from), end: iso(to) });

  const [addEvent] = useAddEventMutation();
  const [updateEvent] = useUpdateEventMutation();
  const [saveException] = useSaveEventExceptionMutation();
  const choose = useChoice();

  const hiddenCalendars = useMemo(
    () => new Set(calendars.filter((c) => !c.is_visible).map((c) => c.id)),
    [calendars],
  );

  /*
    Expected money, as rows in the shape the RPC returns: a forecast drawn
    with the money overlay, and `data.expected` so it never reads as a fact.
  */
  const forecastRows = useMemo<CalendarRow[]>(() => {
    if (schedules.length === 0) return [];
    const currency = new Map(moneyAccounts.map((a) => [a.id, a.currency]));
    return expectedMoneyDays({
      schedules,
      currencyOf: (id) => currency.get(id),
      skips: new Set(skipKeys),
      from,
      until: to,
    }).map((day) => ({
      item_id: `money-forecast-${day.date}`,
      title: day.items.map((item) => item.name).join(", "),
      start_time: `${day.date}T00:00:00+00:00`,
      end_time: null,
      item_type: "transaction_summary" as const,
      is_all_day: true,
      data: {
        expected: true,
        earned: majorUnits(day.inMinor, day.currency),
        spent: majorUnits(day.outMinor, day.currency),
        count: day.items.length,
        currency: day.currency,
        items: day.items,
      },
    }));
  }, [schedules, skipKeys, moneyAccounts, from, to]);

  const entries = useMemo(() => {
    const built = buildEntries({
      rows: [...rows, ...forecastRows],
      exceptions,
      windowStart: from,
      windowEnd: addDays(to, 1),
    });
    const visible = filterEntries(built, {
      hiddenCalendars,
      showTasks: settings?.show_tasks ?? true,
      showHabits: settings?.show_habits ?? false,
      showFinance: settings?.show_finance ?? false,
    });
    return withCalendarColors(visible, calendars);
  }, [
    rows,
    forecastRows,
    exceptions,
    from,
    to,
    hiddenCalendars,
    settings,
    calendars,
  ]);

  const scheduledTaskIds = useMemo(
    () =>
      new Set(
        entries.map((e) => e.taskId).filter((id): id is string => Boolean(id)),
      ),
    [entries],
  );

  const defaultCalendarId =
    calendars.find((c) => c.is_default)?.id ?? calendars[0]?.id ?? null;

  /** A new timed or all-day event, in the default calendar. */
  const createEvent = async (input: {
    title: string;
    start: Date;
    end: Date;
    isAllDay: boolean;
    calendarId?: string | null;
  }) => {
    try {
      await addEvent({
        title: input.title,
        start_time: input.start.toISOString(),
        end_time: input.end.toISOString(),
        is_all_day: input.isAllDay,
        calendar_id: input.calendarId ?? defaultCalendarId,
      } as never).unwrap();
      toast.success(`Added “${input.title}”`);
      return true;
    } catch (err) {
      toast.error("Couldn't add the event", {
        description: getErrorMessage(err),
      });
      return false;
    }
  };

  /** Turn a dragged task into a block of time. */
  const scheduleTask = async (taskId: string, start: Date) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const minutes = task.estimate_minutes ?? DEFAULT_BLOCK_MINUTES;
    try {
      await addEvent({
        title: task.title,
        start_time: start.toISOString(),
        end_time: new Date(start.getTime() + minutes * 60_000).toISOString(),
        is_all_day: false,
        task_id: taskId,
        ...(defaultCalendarId ? { calendar_id: defaultCalendarId } : {}),
      } as never).unwrap();
      toast.success(
        `Blocked ${format(start, "EEE HH:mm")} for “${task.title}”`,
        {
          description: task.estimate_minutes
            ? undefined
            : "No estimate on this task, so an hour was set aside.",
        },
      );
    } catch (err) {
      toast.error("Couldn't schedule it", {
        description: getErrorMessage(err),
      });
    }
  };

  /**
   * A dragged or resized event's new time. One occurrence of a series is
   * ambiguous, so it asks: "just this one" writes an exception and leaves
   * the rest of the series where it was.
   */
  const moveEntry = async (entry: CalendarEntry, start: Date, end: Date) => {
    if (entry.kind !== "event") return;
    if (
      entry.start.getTime() === start.getTime() &&
      entry.end.getTime() === end.getTime()
    )
      return;
    const done = () =>
      toast.success(`Moved to ${format(start, "EEE d MMM, HH:mm")}`);
    try {
      if (entry.rrule && entry.occurrenceStart) {
        const choice = await choose({
          title: "Move the whole series?",
          description:
            "This event repeats. Moving the series shifts every occurrence; moving just this one leaves the rest where they are.",
          confirmText: "Whole series",
          alternativeText: "Just this one",
        });
        if (!choice) return;
        if (choice === "confirm") {
          const { start: seriesStart, end: seriesEnd } = shiftSeries(
            entry,
            start,
            end,
          );
          await updateEvent({
            id: entry.sourceId,
            start_time: seriesStart.toISOString(),
            end_time: seriesEnd.toISOString(),
          } as never).unwrap();
        } else {
          await saveException({
            event_id: entry.sourceId,
            original_start: entry.occurrenceStart.toISOString(),
            new_start: start.toISOString(),
            new_end: end.toISOString(),
          }).unwrap();
        }
        done();
        return;
      }
      await updateEvent({
        id: entry.sourceId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      } as never).unwrap();
      done();
    } catch (err) {
      toast.error("Couldn't move it", { description: getErrorMessage(err) });
    }
  };

  return {
    settings,
    saveSettings,
    calendars,
    tasks,
    rows,
    entries,
    hiddenCalendars,
    scheduledTaskIds,
    defaultCalendarId,
    isLoading,
    isFetching,
    error,
    refetch,
    createEvent,
    scheduleTask,
    moveEntry,
  };
}
