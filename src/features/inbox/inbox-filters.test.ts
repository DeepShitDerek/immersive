import { describe, expect, it } from "vitest";
import { nextSelection } from "./inbox-filters";

describe("inbox selection", () => {
  it("fills the detail pane with the first message on a wide screen", () => {
    expect(nextSelection(["a", "b"], null, false)).toBe("a");
    // An open message that left the view (archived, filtered out) is replaced.
    expect(nextSelection(["b"], "a", false)).toBe("b");
  });

  it("never opens a message by itself on a narrow screen, so the list stays reachable", () => {
    // Arriving, and after closing the sheet: nothing is selected, and nothing is chosen for the reader.
    expect(nextSelection(["a", "b"], null, true)).toBeUndefined();
    // The open message left the view: the sheet closes.
    expect(nextSelection(["b"], "a", true)).toBeNull();
  });

  it("keeps a selection that is still in view, on any width", () => {
    expect(nextSelection(["a", "b"], "b", false)).toBeUndefined();
    expect(nextSelection(["a", "b"], "b", true)).toBeUndefined();
  });

  it("clears the selection when the view is empty", () => {
    expect(nextSelection([], "a", false)).toBeNull();
    expect(nextSelection([], null, true)).toBeUndefined();
  });
});
