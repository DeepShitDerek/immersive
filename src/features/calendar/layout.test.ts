import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "@/types";
import {
  allDayRange,
  atMinutes,
  entriesByDay,
  layoutAllDay,
  layoutDay,
  layoutMonthWeek,
  minutesOfDay,
  segmentsForDay,
  snapMinutes,
  timeLabel,
  weeksOf,
} from "./layout";

const d = (s: string) => new Date(s);
let n = 0;
const ev = (
  start: string,
  end: string,
  over: Partial<CalendarEntry> = {},
): CalendarEntry => ({
  id: `e${++n}`,
  sourceId: `e${n}`,
  kind: "event",
  title: over.title ?? `E${n}`,
  start: d(start),
  end: d(end),
  isAllDay: false,
  ...over,
});
const day = (s: string) => d(`${s}T00:00:00`);

describe("time grid segments", () => {
  it("places a timed event by wall-clock minutes", () => {
    const [seg] = segmentsForDay(
      [ev("2026-10-05T09:30:00", "2026-10-05T11:00:00")],
      day("2026-10-05"),
    );
    expect([seg.startMin, seg.endMin]).toEqual([570, 660]);
  });

  it("splits an event across midnight into two days", () => {
    const e = ev("2026-10-05T22:00:00", "2026-10-06T01:00:00");
    const [first] = segmentsForDay([e], day("2026-10-05"));
    const [second] = segmentsForDay([e], day("2026-10-06"));
    expect(first).toMatchObject({
      startMin: 1320,
      endMin: 1440,
      continuesAfter: true,
    });
    expect(second).toMatchObject({
      startMin: 0,
      endMin: 60,
      continuesBefore: true,
    });
  });

  it("ends an event at exactly midnight at 24:00, and does not draw it on the next day", () => {
    const e = ev("2026-10-05T23:00:00", "2026-10-06T00:00:00");
    expect(segmentsForDay([e], day("2026-10-05"))[0].endMin).toBe(1440);
    expect(segmentsForDay([e], day("2026-10-06"))).toHaveLength(0);
  });

  it("keeps all-day entries and overlays out of the time grid", () => {
    const all = ev("2026-10-05T00:00:00", "2026-10-06T00:00:00", {
      isAllDay: true,
    });
    const task = ev("2026-10-05T00:00:00", "2026-10-05T00:00:00", {
      kind: "task",
    });
    expect(segmentsForDay([all, task], day("2026-10-05"))).toHaveLength(0);
  });

  it("uses wall-clock minutes, so a time on a DST day is where the clock says", () => {
    // Whatever the zone, minutesOfDay reads the local clock face.
    const t = new Date(2026, 2, 29, 9, 0);
    expect(minutesOfDay(t)).toBe(540);
    expect(atMinutes(new Date(2026, 2, 29), 540).getHours()).toBe(9);
  });
});

describe("overlap layout", () => {
  const place = (...es: CalendarEntry[]) =>
    layoutDay(segmentsForDay(es, day("2026-10-05")));

  it("gives a lone event the full width", () => {
    const [p] = place(ev("2026-10-05T09:00:00", "2026-10-05T10:00:00"));
    expect(p).toMatchObject({ col: 0, cols: 1, span: 1 });
  });

  it("puts two overlapping events side by side", () => {
    const placed = place(
      ev("2026-10-05T09:00:00", "2026-10-05T10:00:00", { title: "A" }),
      ev("2026-10-05T09:30:00", "2026-10-05T10:30:00", { title: "B" }),
    );
    expect(placed.map((p) => [p.entry.title, p.col, p.cols])).toEqual([
      ["A", 0, 2],
      ["B", 1, 2],
    ]);
  });

  it("does not let back-to-back events share columns", () => {
    const placed = place(
      ev("2026-10-05T09:00:00", "2026-10-05T10:00:00"),
      ev("2026-10-05T10:00:00", "2026-10-05T11:00:00"),
    );
    expect(placed.every((p) => p.cols === 1)).toBe(true);
  });

  it("widens a long event into a column left empty beside it", () => {
    const placed = place(
      ev("2026-10-05T09:00:00", "2026-10-05T12:00:00", { title: "Long" }),
      ev("2026-10-05T09:00:00", "2026-10-05T09:30:00", { title: "Short1" }),
      ev("2026-10-05T09:00:00", "2026-10-05T09:30:00", { title: "Short2" }),
      ev("2026-10-05T10:00:00", "2026-10-05T11:00:00", { title: "Later" }),
    );
    const later = placed.find((p) => p.entry.title === "Later")!;
    expect(later.cols).toBe(3);
    expect(later.col).toBe(1);
    expect(later.span).toBe(2);
  });

  it("treats a 5-minute event as tall enough to collide", () => {
    const placed = place(
      ev("2026-10-05T09:00:00", "2026-10-05T09:05:00"),
      ev("2026-10-05T09:10:00", "2026-10-05T09:40:00"),
    );
    expect(placed.every((p) => p.cols === 2)).toBe(true);
  });
});

describe("all-day row", () => {
  const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i));

  it("reads an exclusive midnight end as the day before", () => {
    const e = ev("2026-10-05T00:00:00", "2026-10-08T00:00:00", {
      isAllDay: true,
    });
    const { first, last } = allDayRange(e);
    expect([first.getDate(), last.getDate()]).toEqual([5, 7]);
  });

  it("treats an all-day row with end equal to start as one day", () => {
    const e = ev("2026-10-05T00:00:00", "2026-10-05T00:00:00", {
      isAllDay: true,
    });
    const { first, last } = allDayRange(e);
    expect(first.getTime()).toBe(last.getTime());
  });

  it("stacks overlapping bars into lanes and reuses a free lane", () => {
    const bars = layoutAllDay(
      [
        ev("2026-10-05T00:00:00", "2026-10-08T00:00:00", {
          isAllDay: true,
          title: "Trip",
        }),
        ev("2026-10-06T00:00:00", "2026-10-07T00:00:00", {
          isAllDay: true,
          title: "Holiday",
        }),
        ev("2026-10-09T00:00:00", "2026-10-10T00:00:00", {
          isAllDay: true,
          title: "Later",
        }),
      ],
      week,
    );
    const by = Object.fromEntries(bars.map((b) => [b.entry.title, b]));
    expect(by.Trip).toMatchObject({ startCol: 0, span: 3, lane: 0 });
    expect(by.Holiday).toMatchObject({ startCol: 1, span: 1, lane: 1 });
    expect(by.Later).toMatchObject({ startCol: 4, lane: 0 });
  });

  it("clips a bar to the visible days and says it continues", () => {
    const bars = layoutAllDay(
      [ev("2026-10-01T00:00:00", "2026-10-07T00:00:00", { isAllDay: true })],
      week,
    );
    expect(bars[0]).toMatchObject({
      startCol: 0,
      span: 2,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("puts overlays (tasks due) in the all-day row", () => {
    const bars = layoutAllDay(
      [ev("2026-10-06T00:00:00", "2026-10-06T00:00:00", { kind: "task" })],
      week,
    );
    expect(bars[0].startCol).toBe(1);
  });
});

describe("month and agenda", () => {
  it("lists an entry on every day it touches, all-day first", () => {
    const days = [new Date(2026, 9, 5), new Date(2026, 9, 6)];
    const map = entriesByDay(
      [
        ev("2026-10-05T09:00:00", "2026-10-05T10:00:00", { title: "Timed" }),
        ev("2026-10-05T00:00:00", "2026-10-07T00:00:00", {
          isAllDay: true,
          title: "Trip",
        }),
      ],
      days,
    );
    expect(map.get("2026-10-05")!.map((e) => e.title)).toEqual([
      "Trip",
      "Timed",
    ]);
    expect(map.get("2026-10-06")!.map((e) => e.title)).toEqual(["Trip"]);
  });

  it("splits a month into weeks of seven", () => {
    expect(
      weeksOf(Array.from({ length: 35 }, (_, i) => new Date(2026, 9, i + 1))),
    ).toHaveLength(5);
  });

  it("labels times, including across midnight", () => {
    const e = ev("2026-10-05T22:00:00", "2026-10-06T01:00:00");
    expect(timeLabel(e)).toBe("22:00–01:00");
    expect(timeLabel(e, day("2026-10-06"))).toBe("Until 01:00");
    expect(timeLabel(e, day("2026-10-05"))).toBe("From 22:00");
  });

  it("snaps to 15 minutes within the day", () => {
    expect(snapMinutes(547)).toBe(540);
    expect(snapMinutes(553)).toBe(555);
    expect(snapMinutes(-20)).toBe(0);
    expect(snapMinutes(1500)).toBe(1440);
  });
});

describe("a week of the month", () => {
  const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i));
  const timed = (day: number, h: number, title: string) =>
    ev(
      `2026-10-${String(day).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00`,
      `2026-10-${String(day).padStart(2, "0")}T${String(h + 1).padStart(2, "0")}:00:00`,
      { title },
    );

  it("draws a multi-day event once, as a bar, and timed entries under it", () => {
    const { bars, days } = layoutMonthWeek(
      [
        ev("2026-10-06T00:00:00", "2026-10-08T00:00:00", {
          isAllDay: true,
          title: "Trip",
        }),
        timed(6, 9, "Call"),
      ],
      week,
      3,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ startCol: 1, span: 2, lane: 0 });
    expect(days[1].timed).toEqual([expect.objectContaining({ line: 1 })]);
    expect(days[1].more).toBe(0);
  });

  it("never shows more than fits: the last line becomes +n more", () => {
    const { days } = layoutMonthWeek(
      [9, 10, 11, 12, 13, 14].map((h) => timed(7, h, `T${h}`)),
      week,
      3,
    );
    expect(days[2].timed.map((t) => t.line)).toEqual([0, 1]);
    expect(days[2].more).toBe(4);
    expect(days[2].moreLine).toBe(2);
  });

  it("uses every line when everything fits", () => {
    const { days } = layoutMonthWeek(
      [9, 10, 11].map((h) => timed(7, h, `T${h}`)),
      week,
      3,
    );
    expect(days[2].timed).toHaveLength(3);
    expect(days[2].more).toBe(0);
  });

  it("counts bars that do not fit into +n more, on each day they cover", () => {
    const { bars, days } = layoutMonthWeek(
      [
        ev("2026-10-05T00:00:00", "2026-10-07T00:00:00", {
          isAllDay: true,
          title: "A",
        }),
        ev("2026-10-05T00:00:00", "2026-10-07T00:00:00", {
          isAllDay: true,
          title: "B",
        }),
        ev("2026-10-05T00:00:00", "2026-10-07T00:00:00", {
          isAllDay: true,
          title: "C",
        }),
      ],
      week,
      2,
    );
    expect(bars).toHaveLength(1);
    expect(days[0].more).toBe(2);
    expect(days[1].more).toBe(2);
    expect(days[2].more).toBe(0);
  });

  it("with room for one line, a busy day shows only +n more", () => {
    const { days } = layoutMonthWeek(
      [timed(5, 9, "a"), timed(5, 10, "b")],
      week,
      1,
    );
    expect(days[0].timed).toHaveLength(0);
    expect(days[0].more).toBe(2);
  });
});
