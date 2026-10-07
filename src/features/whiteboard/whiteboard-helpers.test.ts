import { describe, expect, it } from "vitest";
import {
  describeSaveState,
  readStylusOnly,
  shouldAutosave,
  shouldBlockPointer,
} from "./pen-input";
import {
  isEmptyScene,
  sceneFingerprint,
  sceneFromJson,
  toInitialData,
  withinPreviewBudget,
  PREVIEW_MAX_CHARS,
} from "./scene-io";

describe("scene fingerprint (what decides 'unsaved')", () => {
  it("ignores deleted elements, so an undo is not an edit", () => {
    const a = [{ version: 2 }, { version: 3, isDeleted: true }];
    expect(sceneFingerprint(a)).toBe("1:2");
  });
  it("moves when an element changes", () => {
    expect(sceneFingerprint([{ version: 2 }])).not.toBe(
      sceneFingerprint([{ version: 3 }]),
    );
  });
  it("does not throw on a row that is not an array", () => {
    expect(sceneFingerprint({})).toBe("0:0");
    expect(sceneFingerprint(null)).toBe("0:0");
  });
});

describe("scene storage", () => {
  it("strips session state, including the saved theme", () => {
    const scene = sceneFromJson(
      JSON.stringify({
        elements: [{ id: "a" }],
        appState: {
          theme: "dark",
          viewBackgroundColor: "#fff",
          collaborators: [],
        },
        files: {},
      }),
    );
    expect(scene.app_state).toEqual({ viewBackgroundColor: "#fff" });
    expect(
      toInitialData({
        id: "b",
        app_state: { selectedElementIds: { a: true }, zoom: 1 },
      }).appState,
    ).toEqual({ zoom: 1 });
  });
  it("stores an unreadable scene as empty rather than failing", () => {
    expect(sceneFromJson("{not json")).toEqual({
      elements: [],
      app_state: {},
      files: {},
    });
    expect(isEmptyScene({ elements: [] })).toBe(true);
  });
  it("keeps thumbnails under the budget", () => {
    expect(withinPreviewBudget("<svg/>")).toBe(true);
    expect(withinPreviewBudget("x".repeat(PREVIEW_MAX_CHARS + 1))).toBe(false);
    expect(withinPreviewBudget(null)).toBe(false);
  });
});

describe("autosave and status", () => {
  it("saves only when dirty, idle and not already saving", () => {
    expect(
      shouldAutosave({
        isDirty: true,
        isSaving: false,
        idleFor: 3000,
        idleThreshold: 2500,
      }),
    ).toBe(true);
    expect(
      shouldAutosave({
        isDirty: true,
        isSaving: false,
        idleFor: 100,
        idleThreshold: 2500,
      }),
    ).toBe(false);
    expect(
      shouldAutosave({
        isDirty: true,
        isSaving: true,
        idleFor: 9000,
        idleThreshold: 2500,
      }),
    ).toBe(false);
    expect(
      shouldAutosave({
        isDirty: false,
        isSaving: false,
        idleFor: 9000,
        idleThreshold: 2500,
      }),
    ).toBe(false);
  });
  it("says when it last saved", () => {
    const now = 1_000_000;
    expect(
      describeSaveState({
        isSaving: false,
        isDirty: false,
        savedAt: now - 3000,
        now,
      }),
    ).toBe("Saved just now");
    expect(
      describeSaveState({
        isSaving: false,
        isDirty: false,
        savedAt: now - 120_000,
        now,
      }),
    ).toBe("Saved 2 minutes ago");
  });
});

describe("pen only", () => {
  it("blocks one finger, never two, never a pen or mouse", () => {
    expect(
      shouldBlockPointer({
        pointerType: "touch",
        stylusOnly: true,
        activeTouches: 1,
      }),
    ).toBe(true);
    expect(
      shouldBlockPointer({
        pointerType: "touch",
        stylusOnly: true,
        activeTouches: 2,
      }),
    ).toBe(false);
    expect(
      shouldBlockPointer({
        pointerType: "pen",
        stylusOnly: true,
        activeTouches: 1,
      }),
    ).toBe(false);
    expect(
      shouldBlockPointer({
        pointerType: "touch",
        stylusOnly: false,
        activeTouches: 1,
      }),
    ).toBe(false);
  });
  it("reads the stored choice, defaulting off", () => {
    expect(readStylusOnly({ getItem: () => null })).toBe(false);
    expect(readStylusOnly({ getItem: () => "true" })).toBe(true);
    expect(
      readStylusOnly({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(false);
  });
});
