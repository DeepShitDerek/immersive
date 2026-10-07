import { afterEach, describe, expect, it } from "vitest";
import {
  OWNS_SHORTCUTS_ATTR,
  shortcutsOwnedByEditor,
} from "./editor-shortcuts";

afterEach(() => document.body.replaceChildren());

describe("shortcutsOwnedByEditor", () => {
  it("is false with no editor open, true while one is", () => {
    expect(shortcutsOwnedByEditor()).toBe(false);
    const panel = document.createElement("div");
    panel.setAttribute(OWNS_SHORTCUTS_ATTR, "");
    document.body.append(panel);
    expect(shortcutsOwnedByEditor()).toBe(true);
  });
});
