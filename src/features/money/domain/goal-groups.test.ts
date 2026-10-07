import { describe, expect, it } from "vitest";
import { type Goal, groupGoals } from "./goals";

const goal = (id: string, flags: Partial<Goal> = {}): Goal => ({
  id,
  name: id,
  targetMinor: 100000,
  currency: "CAD",
  targetDate: null,
  accountIds: [],
  notes: null,
  achievedAt: null,
  archivedAt: null,
  ...flags,
});

describe("groupGoals", () => {
  it("puts each goal in one group: in progress, achieved or archived", () => {
    const groups = groupGoals([
      goal("trip"),
      goal("fund", { achievedAt: "2026-09-01T00:00:00Z" }),
      goal("car", { archivedAt: "2026-08-01T00:00:00Z" }),
    ]);
    expect(groups.active.map((g) => g.id)).toEqual(["trip"]);
    expect(groups.achieved.map((g) => g.id)).toEqual(["fund"]);
    expect(groups.archived.map((g) => g.id)).toEqual(["car"]);
  });

  it("files an achieved goal that was then archived under archived only", () => {
    const groups = groupGoals([
      goal("fund", {
        achievedAt: "2026-09-01T00:00:00Z",
        archivedAt: "2026-09-02T00:00:00Z",
      }),
    ]);
    expect(groups.achieved).toEqual([]);
    expect(groups.archived.map((g) => g.id)).toEqual(["fund"]);
  });

  it("shows the most recently achieved first", () => {
    const groups = groupGoals([
      goal("older", { achievedAt: "2026-01-01T00:00:00Z" }),
      goal("newer", { achievedAt: "2026-09-01T00:00:00Z" }),
    ]);
    expect(groups.achieved.map((g) => g.id)).toEqual(["newer", "older"]);
  });
});
