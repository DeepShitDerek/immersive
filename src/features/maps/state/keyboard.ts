/**
 * Keyboard shortcuts (§21), as data.
 *
 * `shortcutFor` turns a key event into an action name; the editor maps names
 * to actions. Keeping the table here means the same source feeds the handler,
 * the tooltips and the context menu hints, and it can be tested without a DOM.
 *
 * The app has no global shortcut layer, so these are scoped to the open
 * editor and never fire while typing in a field.
 */

export type ShortcutAction =
  | "addChild"
  | "addSibling"
  | "delete"
  | "escape"
  | "undo"
  | "redo"
  | "search"
  | "selectAll"
  | "copy"
  | "paste"
  | "duplicate"
  | "connect"
  | "rename"
  | "fit";

export interface KeyLike {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** Ctrl on Windows/Linux, ⌘ on Apple. */
function mod(event: KeyLike, mac: boolean) {
  return mac ? Boolean(event.metaKey) : Boolean(event.ctrlKey);
}

export function shortcutFor(
  event: KeyLike,
  mac = isMac(),
): ShortcutAction | null {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const m = mod(event, mac);
  if (event.altKey) return null;

  if (m) {
    if (key === "z") return event.shiftKey ? "redo" : "undo";
    if (key === "y" && !mac) return "redo";
    if (key === "f") return "search";
    if (key === "a") return "selectAll";
    if (key === "c") return "copy";
    if (key === "v") return "paste";
    if (key === "d") return "duplicate";
    if (key === "l") return "connect";
    return null;
  }
  if (event.metaKey || event.ctrlKey) return null;

  switch (key) {
    case "Tab":
      return event.shiftKey ? null : "addChild";
    case "Enter":
      return event.shiftKey ? null : "addSibling";
    case "Delete":
    case "Backspace":
      return "delete";
    case "Escape":
      return "escape";
    case "F2":
      return "rename";
    case "1":
      return event.shiftKey ? "fit" : null;
    default:
      return null;
  }
}

/** Human-readable shortcut for tooltips and menus. */
export function shortcutLabel(action: ShortcutAction, mac = isMac()): string {
  const m = mac ? "⌘" : "Ctrl+";
  const shift = mac ? "⇧" : "Shift+";
  const labels: Record<ShortcutAction, string> = {
    addChild: "Tab",
    addSibling: "Enter",
    delete: "Delete",
    escape: "Esc",
    undo: `${m}Z`,
    redo: `${m}${shift}Z`,
    search: `${m}F`,
    selectAll: `${m}A`,
    copy: `${m}C`,
    paste: `${m}V`,
    duplicate: `${m}D`,
    connect: `${m}L`,
    rename: "F2",
    fit: `${shift}1`,
  };
  return labels[action];
}

/** True when a key event is aimed at something the person is typing in. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== "string")
    return false;
  const el = target as HTMLElement;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  );
}
