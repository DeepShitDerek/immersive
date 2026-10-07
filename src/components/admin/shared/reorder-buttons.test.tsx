import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReorderButtons from "./reorder-buttons";

describe("reorder buttons (Content and Navigation)", () => {
  it("moves in both directions, named after the row", () => {
    const up = vi.fn();
    const down = vi.fn();
    render(<ReorderButtons name="Blog" onMoveUp={up} onMoveDown={down} />);
    fireEvent.click(screen.getByRole("button", { name: "Move up: Blog" }));
    fireEvent.click(screen.getByRole("button", { name: "Move down: Blog" }));
    expect(up).toHaveBeenCalledOnce();
    expect(down).toHaveBeenCalledOnce();
  });

  it("disables a direction the row cannot move in", () => {
    render(<ReorderButtons name="Work" onMoveDown={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Move up: Work" }),
    ).toHaveProperty("disabled", true);
    expect(
      screen.getByRole("button", { name: "Move down: Work" }),
    ).toHaveProperty("disabled", false);
  });
});
