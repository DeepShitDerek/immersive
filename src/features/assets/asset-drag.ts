/**
 * Dragging assets between folders.
 *
 * Two different drags land on the same page and must never be confused:
 *
 *  - **Files from the desktop**, which upload into the current folder.
 *  - **Assets already in the library**, which move.
 *
 * The browser tells them apart through `dataTransfer.types`: an OS file drag
 * carries `"Files"`, and an in-app drag carries whatever type the drag source
 * set. Guarding on that is not cosmetic — without it, dragging an asset over
 * the grid raises the "drop to upload" overlay over a gesture that is not an
 * upload, and dropping it there runs the upload handler with no files.
 *
 * A distinct MIME type, an encoder, and a
 * decoder that assumes nothing about what it is handed, because `dataTransfer`
 * carries whatever the page it came from put there — including a drag that
 * started outside the app.
 */

/** The type the folder cards listen for. Distinct from the calendar's. */
export const ASSET_MOVE_TYPE = "application/x-asset-move";

export interface AssetMovePayload {
  /** The assets being moved. More than one when a selection is dragged. */
  assetIds: string[];
}

export function encodeAssetMove(payload: AssetMovePayload): string {
  return JSON.stringify(payload);
}

export function decodeAssetMove(
  raw: string | null | undefined,
): AssetMovePayload | null {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const ids = (parsed as Record<string, unknown>).assetIds;
    if (!Array.isArray(ids)) return null;

    const assetIds = ids.filter(
      (id): id is string => typeof id === "string" && id !== "",
    );
    return assetIds.length > 0 ? { assetIds } : null;
  } catch {
    return null;
  }
}

/**
 * Whether a drag is files arriving from outside the browser.
 *
 * `types` is the only thing readable during `dragover` — the data itself is
 * withheld until the drop for security reasons — so the decision about which
 * overlay to show has to be made from it.
 */
export function isFileDrag(types: readonly string[] | undefined): boolean {
  return (types ?? []).includes("Files");
}

/** Whether a drag is assets being moved within the library. */
export function isAssetDrag(types: readonly string[] | undefined): boolean {
  return (types ?? []).includes(ASSET_MOVE_TYPE);
}
