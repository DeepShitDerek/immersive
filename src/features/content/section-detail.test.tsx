import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PortfolioSection } from "@/types";

// The rich editor stands in as a textarea: this is about when saves happen.
vi.mock("@/components/admin/novel-editor", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label="content"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const { SectionDetail } = await import("./section-detail");

const section = (id: string, content: string) =>
  ({
    id,
    title: `Section ${id}`,
    type: "markdown",
    content,
    page_path: "/about",
    is_visible: true,
    portfolio_items: [],
  }) as unknown as PortfolioSection;

function setup(initial = section("s1", "Hello")) {
  const onSaveContent = vi.fn(async () => {});
  const noop = vi.fn();
  const utils = render(
    <SectionDetail
      section={initial}
      onEditSection={noop}
      onDeleteSection={noop}
      onToggleVisible={noop}
      onSaveContent={onSaveContent}
      onNewItem={noop}
      onEditItem={noop}
      onDeleteItem={noop}
      onMoveItem={noop}
    />,
  );
  const rerender = (next: PortfolioSection) =>
    utils.rerender(
      <SectionDetail
        section={next}
        onEditSection={noop}
        onDeleteSection={noop}
        onToggleVisible={noop}
        onSaveContent={onSaveContent}
        onNewItem={noop}
        onEditItem={noop}
        onDeleteItem={noop}
        onMoveItem={noop}
      />,
    );
  return { ...utils, onSaveContent, rerender };
}

const type = (text: string) =>
  fireEvent.change(screen.getByLabelText("content"), {
    target: { value: text },
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("markdown section autosave", () => {
  it("saves once, after typing pauses — not on every keystroke", async () => {
    const { onSaveContent } = setup();
    type("Hello w");
    type("Hello wo");
    type("Hello wor");
    type("Hello world");
    expect(onSaveContent).not.toHaveBeenCalled();
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(onSaveContent).toHaveBeenCalledTimes(1);
    expect(onSaveContent).toHaveBeenCalledWith(
      { id: "s1", content: "Hello world" },
      { silent: true },
    );
  });

  it("saves the section being left when another is opened", async () => {
    const { onSaveContent, rerender } = setup();
    type("Unsaved change");
    await act(async () => {
      rerender(section("s2", "Other"));
      await vi.runAllTimersAsync();
    });
    expect(onSaveContent).toHaveBeenCalledWith(
      { id: "s1", content: "Unsaved change" },
      { silent: true },
    );
    expect(onSaveContent).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "s2" }),
      expect.anything(),
    );
  });

  it("saves what is pending when the editor closes", async () => {
    const { onSaveContent, unmount } = setup();
    type("Last words");
    await act(async () => {
      unmount();
      await vi.runAllTimersAsync();
    });
    expect(onSaveContent).toHaveBeenCalledWith(
      { id: "s1", content: "Last words" },
      { silent: true },
    );
  });
});

describe("section header", () => {
  it("says in words whether the section is on the site, and the switch changes it", () => {
    const onToggleVisible = vi.fn();
    const hidden = {
      ...section("s1", "Hi"),
      is_visible: false,
    } as PortfolioSection;
    render(
      <SectionDetail
        section={hidden}
        onEditSection={vi.fn()}
        onDeleteSection={vi.fn()}
        onToggleVisible={onToggleVisible}
        onSaveContent={vi.fn()}
        onNewItem={vi.fn()}
        onEditItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onMoveItem={vi.fn()}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Shown on the site" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(onToggleVisible).toHaveBeenCalledWith(hidden);
  });

  it("links to the live page", () => {
    setup();
    expect(screen.getByRole("link", { name: /view on site/i })).toHaveAttribute(
      "href",
      "/about",
    );
  });
});
