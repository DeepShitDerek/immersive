/**
 * A full-screen editor that brings its own keyboard (Excalidraw) marks its
 * root with this attribute, and the shell's global shortcuts stand aside
 * while it is on screen.
 *
 * Without it, "?" opened the workspace keyboard map over the whiteboard at
 * the same moment as Excalidraw's own help, and ⌘K toggled the command
 * palette instead of adding a link to the selected shape. The canvas is not a
 * text field, so the usual "typing" check never applied.
 */
export const OWNS_SHORTCUTS_ATTR = "data-owns-shortcuts";

export function shortcutsOwnedByEditor(): boolean {
  return (
    typeof document !== "undefined" &&
    document.querySelector(`[${OWNS_SHORTCUTS_ATTR}]`) !== null
  );
}
