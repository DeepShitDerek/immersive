import { describe, expect, it } from "vitest";
import { windowHours } from "./day-plan";

const at = (h: number) => new Date(2026, 9, 5, h, 20);

describe("windowHours", () => {
  it("starts at the current hour", () => {
    expect(windowHours(at(10), 7, 22, 6)).toEqual([10, 11, 12, 13, 14, 15]);
  });
  it("starts at the start of the day before it begins", () => {
    expect(windowHours(at(5), 7, 22, 3)).toEqual([7, 8, 9]);
  });
  it("shows the last hours after the day is over, never nothing", () => {
    expect(windowHours(at(23), 7, 22, 3)).toEqual([19, 20, 21]);
  });
  it("stays inside the day near its end", () => {
    expect(windowHours(at(20), 7, 22, 6)).toEqual([16, 17, 18, 19, 20, 21]);
  });
});
