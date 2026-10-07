import { describe, expect, it } from "vitest";
import type { CalendarRow } from "@/types";
import { todaysEvents } from "./todays-events";

// A fixed local "today", so the test does not depend on when it runs.
const dayStart = new Date(2026, 8, 25); // Fri 25 Sep 2026, local midnight
const dayEnd = new Date(2026, 8, 26);
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 8, day, hour, minute).toISOString();

const event = (
  id: string,
  start: string,
  end: string | null,
  data: Record<string, unknown> = {},
): CalendarRow => ({
  item_id: id,
  title: id,
  start_time: start,
  end_time: end,
  item_type: "event",
  is_all_day: false,
  data: { status: "confirmed", calendar_id: null, ...data },
});

describe("dashboard: today's events", () => {
  it("includes a weekly series that started weeks ago", () => {
    const standup = event("standup", at(4, 9, 30), at(4, 9, 45), {
      rrule: "FREQ=WEEKLY",
    }); // Fridays from 4 Sep
    const [today] = todaysEvents({
      rows: [standup],
      exceptions: [],
      calendars: [],
      dayStart,
      dayEnd,
    });
    expect(today).toMatchObject({
      title: "standup",
      start_time: at(25, 9, 30),
      end_time: at(25, 9, 45),
    });
  });

  it("leaves out cancelled events, hidden calendars and a cancelled occurrence; follows a moved one", () => {
    const rows = [
      event("cancelled", at(25, 11), at(25, 12), { status: "cancelled" }),
      event("hidden", at(25, 13), at(25, 14), { calendar_id: "cal-hidden" }),
      event("visible", at(25, 15), at(25, 16), { calendar_id: "cal-shown" }),
      event("weekly-skipped", at(18, 8), at(18, 9), { rrule: "FREQ=WEEKLY" }),
      event("weekly-moved", at(18, 10), at(18, 11), { rrule: "FREQ=WEEKLY" }),
    ];
    const exceptions = [
      {
        id: "x1",
        event_id: "weekly-skipped",
        original_start: at(25, 8),
        is_cancelled: true,
      },
      {
        id: "x2",
        event_id: "weekly-moved",
        original_start: at(25, 10),
        is_cancelled: false,
        new_start: at(25, 17),
        new_end: at(25, 18),
      },
    ];
    const calendars = [
      { id: "cal-hidden", is_visible: false },
      { id: "cal-shown", is_visible: true },
    ];
    const result = todaysEvents({
      rows,
      exceptions,
      calendars,
      dayStart,
      dayEnd,
    });
    expect(result.map((e) => [e.title, e.start_time])).toEqual([
      ["visible", at(25, 15)],
      ["weekly-moved", at(25, 17)],
    ]);
  });

  it("includes an event that began before midnight and runs into today, and ignores tasks", () => {
    const lateNight = event("late", at(24, 23), at(25, 1));
    const task: CalendarRow = {
      ...event("task-1", at(25, 0), null),
      item_type: "task",
    };
    const result = todaysEvents({
      rows: [lateNight, task],
      exceptions: [],
      calendars: [],
      dayStart,
      dayEnd,
    });
    expect(result.map((e) => e.title)).toEqual(["late"]);
  });
});
