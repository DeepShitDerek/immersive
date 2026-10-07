import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentCard, NewDocumentCard } from "./document-card";

describe("DocumentCard", () => {
  it("opens, says it is pinned, and keeps its menu visible", () => {
    const onOpen = vi.fn();
    render(
      <DocumentCard
        title="Plan"
        thumbnail={null}
        meta="Edited today"
        pinned
        onOpen={onOpen}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Plan" }));
    expect(onOpen).toHaveBeenCalled();
    expect(screen.getByText(", pinned")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "More actions for Plan" }),
    ).toBeVisible();
  });

  it("names an untitled document", () => {
    render(
      <DocumentCard
        title="  "
        untitled="Untitled board"
        thumbnail={null}
        onOpen={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Open Untitled board" }),
    ).toBeInTheDocument();
  });
});

describe("NewDocumentCard", () => {
  it("starts a new one", () => {
    const onClick = vi.fn();
    render(<NewDocumentCard label="New board" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "New board" }));
    expect(onClick).toHaveBeenCalled();
  });
});
