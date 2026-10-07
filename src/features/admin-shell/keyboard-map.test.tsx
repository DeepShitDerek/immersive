import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  KeyboardMap,
  keyboardSections,
  OPEN_KEYBOARD_MAP,
} from "./keyboard-map";

describe("keyboard map", () => {
  it("opens on ? but not while typing", () => {
    render(
      <>
        <input aria-label="Title" />
        <KeyboardMap />
      </>,
    );
    fireEvent.keyDown(screen.getByLabelText("Title"), { key: "?" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(document.body, { key: "?" });
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeTruthy();
  });

  it("opens from the command palette", () => {
    render(<KeyboardMap />);
    act(() => {
      document.dispatchEvent(new Event(OPEN_KEYBOARD_MAP));
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("lists the keys the code binds: the palette, the four review ratings, Maps' own labels", () => {
    const sections = keyboardSections(true);
    const rows = Object.fromEntries(sections.flatMap((s) => s.rows));
    expect(rows["Search, or jump to a module"]).toBe("⌘K");
    expect(
      ["1", "2", "3", "4"].every((k) => Object.values(rows).includes(k)),
    ).toBe(true);
    expect(rows["Rename"]).toBe("F2");
    expect(keyboardSections(false).flatMap((s) => s.rows)[0][1]).toBe("Ctrl+K");
  });
});
