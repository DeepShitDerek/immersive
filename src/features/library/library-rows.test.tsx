import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LibraryHighlight, LibrarySource } from "@/types";
import { HighlightItem, NowReading, SourceRow } from "./library-rows";

const source = (over: Partial<LibrarySource> = {}): LibrarySource => ({
  id: "s1",
  kind: "video",
  title: "A talk",
  creator: "Someone",
  status: "in_progress",
  url: null,
  ...over,
});

describe("SourceRow", () => {
  it("says the status in the kind's own words, with one menu for the rest", () => {
    render(
      <ul>
        <SourceRow
          source={source()}
          kept={2}
          onOpen={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
          onStatus={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText("Watching")).toBeInTheDocument();
    expect(
      screen.getByText("Someone · Video · 2 highlights"),
    ).toBeInTheDocument();
    // The status select, Play, Open, Edit and Delete are gone from the row.
    expect(
      screen
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label") ?? b.textContent),
    ).toEqual([
      "A talkSomeone · Video · 2 highlights",
      "More actions for A talk",
    ]);
  });
});

describe("NowReading", () => {
  it("is absent when nothing is in progress", () => {
    const { container } = render(
      <NowReading sources={[]} keptPer={new Map()} onOpen={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("continues the source it names", () => {
    const onOpen = vi.fn();
    render(
      <NowReading sources={[source()]} keptPer={new Map()} onOpen={onOpen} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue A talk" }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
  });
});

describe("HighlightItem", () => {
  it("shows favourite and on-the-site as states, not buttons", () => {
    const highlight = {
      id: "h1",
      text: "A line",
      is_favorite: true,
      is_public: true,
    } as LibraryHighlight;
    render(
      <ul>
        <HighlightItem
          highlight={highlight}
          source={undefined}
          cite={null}
          onOpenSource={vi.fn()}
          onToggle={vi.fn()}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText("Favourite")).toBeInTheDocument();
    expect(screen.getByText("On the site")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
