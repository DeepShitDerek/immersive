import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "./quick-add";

// A Wednesday.
const TODAY = "2026-10-07";
const projects = [
  { id: "p1", name: "Home renovation" },
  { id: "p2", name: "Work" },
  { id: "p3", name: "Writing" },
];

describe("parseQuickAdd", () => {
  it("keeps a plain line as the title", () => {
    expect(parseQuickAdd("  Call the bank  ", projects, TODAY)).toMatchObject({
      title: "Call the bank",
      dueDate: null,
      projectId: null,
      priority: null,
      tags: [],
      understood: [],
    });
  });

  it("reads today, tomorrow and weekdays as the due date", () => {
    expect(parseQuickAdd("Pay rent today", projects, TODAY).dueDate).toBe(
      "2026-10-07",
    );
    expect(parseQuickAdd("Pay rent tomorrow", projects, TODAY).dueDate).toBe(
      "2026-10-08",
    );
    expect(parseQuickAdd("Pay rent fri", projects, TODAY).dueDate).toBe(
      "2026-10-09",
    );
    // The same weekday means next week, not today.
    expect(parseQuickAdd("Standup wednesday", projects, TODAY).dueDate).toBe(
      "2026-10-14",
    );
    expect(
      parseQuickAdd("Pay rent tomorrow", projects, TODAY).understood,
    ).toContain("Due tomorrow");
  });

  it("leaves words that only look like dates in the title", () => {
    expect(parseQuickAdd("Buy sun cream", projects, TODAY)).toMatchObject({
      title: "Buy sun cream",
      dueDate: null,
    });
    expect(
      parseQuickAdd("Monitor the build", projects, TODAY).dueDate,
    ).toBeNull();
    expect(parseQuickAdd("Groceries saturday", projects, TODAY).dueDate).toBe(
      "2026-10-10",
    );
    const result = parseQuickAdd("Today's standup notes", projects, TODAY);
    expect(result.title).toBe("Today's standup notes");
    expect(result.dueDate).toBeNull();
  });

  it("matches #project by name or an unambiguous prefix, else makes a tag", () => {
    expect(
      parseQuickAdd("Paint #home-renovation", projects, TODAY).projectId,
    ).toBe("p1");
    expect(parseQuickAdd("Paint #home", projects, TODAY).projectId).toBe("p1");
    // "w" starts both Work and Writing: a tag, not a guess.
    const ambiguous = parseQuickAdd("Draft #w", projects, TODAY);
    expect(ambiguous.projectId).toBeNull();
    expect(ambiguous.tags).toEqual(["w"]);
    expect(parseQuickAdd("Read #ml", projects, TODAY)).toMatchObject({
      projectId: null,
      tags: ["ml"],
      title: "Read",
    });
  });

  it("reads !high, !med and !low, short forms included", () => {
    expect(parseQuickAdd("Ship it !high", projects, TODAY).priority).toBe(
      "high",
    );
    expect(parseQuickAdd("Ship it !m", projects, TODAY).priority).toBe(
      "medium",
    );
    expect(parseQuickAdd("Ship it !L", projects, TODAY).priority).toBe("low");
    // Not a priority word: stays in the title.
    expect(parseQuickAdd("Wow !!", projects, TODAY).title).toBe("Wow !!");
  });

  it("combines them in any order", () => {
    expect(
      parseQuickAdd("#work !high tomorrow Review the PR", projects, TODAY),
    ).toMatchObject({
      title: "Review the PR",
      dueDate: "2026-10-08",
      projectId: "p2",
      priority: "high",
    });
  });
});
