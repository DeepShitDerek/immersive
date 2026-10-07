import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HabitCell } from "./habit-cell";
import { StreakBadge } from "./habit-streak";

const cell = (
  partial?: { ratio: number; label: string } | null,
  isCompleted = false,
) => (
  <HabitCell
    dateStr="2026-10-01"
    isCompleted={isCompleted}
    isScheduled
    color="#2f3ab2"
    onToggle={() => {}}
    isToday={false}
    partial={partial}
  />
);

describe("habit history cell", () => {
  it("says how far a count habit got, not just done or not", () => {
    render(cell({ ratio: 3 / 8, label: "3 of 8" }));
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Mark Oct 1st as complete (3 of 8 so far)",
    );
    expect(
      (screen.getByRole("button") as HTMLElement).style.backgroundColor,
    ).not.toBe("");
  });

  it("leaves an untouched day unfilled", () => {
    render(cell(null));
    expect(screen.getByRole("button").getAttribute("aria-label")).toBe(
      "Mark Oct 1st as complete",
    );
    expect(
      (screen.getByRole("button") as HTMLElement).style.backgroundColor,
    ).toBe("");
  });
});

describe("StreakBadge", () => {
  it("names the streak for screen readers", () => {
    render(<StreakBadge streak={4} />);
    expect(screen.getByText("4-day streak")).toBeTruthy();
  });
});
