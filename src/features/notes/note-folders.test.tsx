import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Note } from "@/types";
import { NoteList } from "./note-list";

const note = (id: string, title: string, extra: Partial<Note> = {}) =>
  ({
    id,
    title,
    content: null,
    tags: [],
    is_pinned: false,
    archived_at: null,
    updated_at: "2026-09-30T10:00:00Z",
    created_at: "2026-09-30T10:00:00Z",
    ...extra,
  }) as unknown as Note;

const notes = [
  note("1", "Groceries", { tags: ["home"] }),
  note("2", "Roadmap", { is_pinned: true, tags: ["work"] }),
  note("3", "Old idea", { archived_at: "2026-09-01T00:00:00Z" }),
];

const mount = () =>
  render(
    <NoteList
      notes={notes}
      selectedId={null}
      onSelect={() => {}}
      onNew={() => {}}
      connectedIds={new Set()}
    />,
  );

const listed = () =>
  screen
    .queryAllByRole("button", { name: /^Open / })
    .map((b) => b.getAttribute("aria-label"));

describe("note folders, Apple Notes style", () => {
  it("lists folders and tags with counts, and starts on All Notes", () => {
    mount();
    const nav = screen.getByRole("navigation", { name: "Note folders" });
    // Label and count are adjacent text, so the name reads "All Notes2".
    expect(
      within(nav)
        .getByRole("button", { name: /All Notes\s*2/ })
        .getAttribute("aria-current"),
    ).toBe("true");
    expect(
      within(nav).getByRole("button", { name: /Pinned\s*1/ }),
    ).toBeTruthy();
    expect(
      within(nav).getByRole("button", { name: /Archive\s*1/ }),
    ).toBeTruthy();
    // No linked notes: the Linked folder stays out of the way.
    expect(within(nav).queryByRole("button", { name: /Linked/ })).toBeNull();
    expect(within(nav).getByRole("button", { name: /home\s*1/ })).toBeTruthy();
    // Pinned notes lead the list.
    expect(listed()).toEqual(["Open Roadmap", "Open Groceries"]);
  });

  it("shows a folder's notes, and a tag's across all active notes", () => {
    mount();
    const nav = screen.getByRole("navigation", { name: "Note folders" });
    fireEvent.click(within(nav).getByRole("button", { name: /Pinned/ }));
    expect(listed()).toEqual(["Open Roadmap"]);
    fireEvent.click(within(nav).getByRole("button", { name: /home/ }));
    expect(listed()).toEqual(["Open Groceries"]);
    fireEvent.click(within(nav).getByRole("button", { name: /Archive/ }));
    expect(listed()).toEqual(["Open Old idea"]);
  });

  it("names the current folder in the narrow-screen switcher", () => {
    mount();
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Note folders" }),
      ).getByRole("button", { name: /work/ }),
    );
    expect(
      screen.getByRole("button", { name: "Folder: #work. Change folder" }),
    ).toBeTruthy();
  });
});
