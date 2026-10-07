import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SaveStatus } from "./save-status";

describe("SaveStatus", () => {
  it("says what happened in words, announced politely", () => {
    render(<SaveStatus state="saved" />);
    const status = screen.getByText("Saved").closest("p")!;
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("uses the danger colour only for an error, with an icon beside the words", () => {
    const { container } = render(
      <SaveStatus state="error" text="Not saved: offline" />,
    );
    expect(container.querySelector("p")!.className).toContain(
      "text-destructive",
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("shows a quiet line when idle, and nothing without one", () => {
    const { container, rerender } = render(
      <SaveStatus state="idle" text="Edited 3 minutes ago" />,
    );
    expect(screen.getByText("Edited 3 minutes ago")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
    rerender(<SaveStatus state="idle" />);
    expect(container.textContent).toBe("");
  });
});
