import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  endOfMonth,
  fromDayNumber,
  isIsoDate,
  makeDate,
  monthsBetween,
  toDayNumber,
  today,
  weekday,
} from "./dates";

describe("dates", () => {
  it("validates real calendar days only", () => {
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2023-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-01")).toBe(false);
    expect(isIsoDate(20260101)).toBe(false);
    expect(() => makeDate(2026, 4, 31)).toThrow();
  });

  it("round-trips day numbers across 400 years", () => {
    for (
      let day = toDayNumber("1900-01-01");
      day < toDayNumber("2300-01-01");
      day += 37
    ) {
      expect(toDayNumber(fromDayNumber(day))).toBe(day);
    }
  });

  it("adds days across month, year and DST boundaries without drifting", () => {
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08"); // Canadian DST starts
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02"); // and ends
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
    expect(daysBetween("2024-01-01", "2025-01-01")).toBe(366);
  });

  it("clamps month ends and keeps an anchor day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-02-28", 1, 31)).toBe("2026-03-31");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-01-31", 12)).toBe("2027-01-31");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
  });

  it("lists months inclusively", () => {
    expect(monthsBetween("2025-11-15", "2026-02-01")).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });

  it("knows weekdays", () => {
    expect(weekday("2026-09-24")).toBe(4); // Thursday
    expect(weekday("1970-01-01")).toBe(4);
    expect(weekday("1969-12-28")).toBe(0);
  });

  it("gives today in a named timezone, not UTC", () => {
    const lateInToronto = new Date("2026-09-25T02:30:00Z"); // 22:30 on the 24th in Toronto
    expect(today("America/Toronto", lateInToronto)).toBe("2026-09-24");
    expect(today("Asia/Kolkata", lateInToronto)).toBe("2026-09-25");
  });
});
