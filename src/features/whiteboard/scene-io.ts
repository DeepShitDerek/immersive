import type { Whiteboard } from "@/types";

/**
 * Translation between an Excalidraw scene and a `whiteboards` row.
 *
 * Serialization goes through the library's own `serializeAsJSON`, which is
 * what an `.excalidraw` file export uses — it already strips the session-only
 * half of appState (collaborators, selection, dragging state). These helpers
 * take the resulting JSON string rather than the live API so they stay pure
 * and testable without mounting the editor.
 */

/** Keys that must never come back from storage, even if a row predates this. */
const TRANSIENT_APP_STATE = [
  "collaborators",
  "selectedElementIds",
  "selectedGroupIds",
  "editingGroupId",
  "isLoading",
  "errorMessage",
  // The board follows the app theme, not whatever it was saved under.
  "theme",
];

export type ScenePayload = Pick<Whiteboard, "elements" | "app_state" | "files">;

/** Split a `serializeAsJSON` string into the three columns it is stored in. */
export function sceneFromJson(json: string): ScenePayload {
  try {
    const parsed = JSON.parse(json) as {
      elements?: unknown[];
      appState?: Record<string, unknown>;
      files?: Record<string, unknown>;
    };
    return {
      elements: parsed.elements ?? [],
      app_state: stripTransient(parsed.appState ?? {}),
      files: parsed.files ?? {},
    };
  } catch {
    // A scene we cannot read is better stored as empty than as a broken row
    // that fails to load forever after.
    return { elements: [], app_state: {}, files: {} };
  }
}

function stripTransient(
  appState: Record<string, unknown>,
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...appState };
  for (const key of TRANSIENT_APP_STATE) delete clean[key];
  return clean;
}

export interface InitialSceneData {
  elements: unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

/** Build the `initialData` prop for a stored board (or a blank one). */
export function toInitialData(board: Whiteboard | null): InitialSceneData {
  return {
    elements: board?.elements ?? [],
    appState: stripTransient(board?.app_state ?? {}),
    files: board?.files ?? {},
  };
}

/** True when the board holds nothing worth a thumbnail. */
export function isEmptyScene(payload: ScenePayload): boolean {
  return (payload.elements?.length ?? 0) === 0;
}

/**
 * A thumbnail is a convenience, not the record — a dense board can serialize
 * to megabytes of SVG, which would defeat the point of keeping the gallery
 * query small. Past this the card falls back to a placeholder.
 */
export const PREVIEW_MAX_CHARS = 200_000;

export function withinPreviewBudget(svg: string | null): boolean {
  return !!svg && svg.length <= PREVIEW_MAX_CHARS;
}

/**
 * A cheap identity for the drawn content of a scene.
 *
 * Excalidraw fires `onChange` for pointer moves, selection changes and its own
 * initial load, so the event says "something happened", never "the drawing
 * changed". Treating it as the latter is what made *opening* a board mark it
 * dirty, so closing an untouched board asked whether to discard edits that
 * did not exist.
 *
 * Every element carries a `version` that the library increments whenever the
 * element actually changes, so the count of live elements plus the sum of
 * their versions moves if and only if the drawing does. That is the library's
 * own documented cheap dirty check, and it costs one pass over the array —
 * which matters, because the alternative is re-serialising the whole scene on
 * every pointer move during a stroke.
 *
 * Deleted elements are excluded: Excalidraw keeps them in the array with
 * `isDeleted`, and counting them would make an undo look like a change.
 *
 * It does not cover appState — changing the canvas background alone is not
 * detected. That is a deliberate trade for not serialising per frame, and it
 * fails safe: the miss is a change that does not prompt, never a prompt for a
 * change that did not happen.
 */
export function sceneFingerprint(elements: unknown): string {
  // `elements` is a JSONB column on the way in and the library's live array on
  // the way out, so it is genuinely `unknown` at this boundary. A row holding
  // an object rather than an array is data the database can return, and it
  // must not throw on the way to deciding whether a Close should prompt.
  if (!Array.isArray(elements)) return "0:0";

  let count = 0;
  let versions = 0;

  for (const element of elements) {
    const el = element as { version?: number; isDeleted?: boolean };
    if (el?.isDeleted) continue;
    count += 1;
    versions += typeof el?.version === "number" ? el.version : 0;
  }

  return `${count}:${versions}`;
}
