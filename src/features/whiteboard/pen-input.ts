/**
 * Pen and touch handling for the drawing surface.
 *
 * Excalidraw draws from pointer events and does not distinguish a stylus from
 * the hand resting beside it, so on a tablet the palm lands first, registers as
 * a touch pointer, and draws a stray stroke before the nib is down. Every
 * drawing app that is usable with a pen solves this the same way: once a stylus
 * has been seen, single-finger touch stops drawing and is reserved for
 * navigation.
 *
 * The decisions live here as pure functions so they can be tested without a
 * digitiser — the bug they prevent is impossible to reproduce with a mouse.
 */

export type PenPointerType = "pen" | "touch" | "mouse" | string;

/** Preference key. Persisted so the setting survives a page reload. */
const STYLUS_ONLY_STORAGE_KEY = "whiteboard:stylus-only";

export interface PointerDecisionInput {
  pointerType: PenPointerType;
  /** True while the owner has stylus-only drawing enabled. */
  stylusOnly: boolean;
  /** Active touch points on the surface, including this one. */
  activeTouches: number;
}

/**
 * Should this pointer event be kept away from the canvas?
 *
 * Only single-finger touch is blocked, and only in stylus-only mode. Two or
 * more fingers is a pan or a pinch, which is the whole point of leaving touch
 * enabled — a mode that blocked all touch would also block navigation and make
 * the board unusable on the device it was meant to help.
 *
 * Pen and mouse are never blocked: a pen is the thing being protected, and a
 * mouse means there is no palm to reject.
 */
export function shouldBlockPointer({
  pointerType,
  stylusOnly,
  activeTouches,
}: PointerDecisionInput): boolean {
  if (!stylusOnly) return false;
  if (pointerType !== "touch") return false;
  return activeTouches <= 1;
}

/**
 * Has a stylus been used on this surface?
 *
 * The toggle stays hidden until one has, because on a laptop it is a control
 * for a problem the owner does not have. `pointerType` is the only reliable
 * signal — `maxTouchPoints` says a screen accepts touch, not that a pen exists,
 * and every iPad reports touch whether or not a Pencil was ever paired.
 */
export function isPenPointer(pointerType: PenPointerType): boolean {
  return pointerType === "pen";
}

/** Read the saved preference. Defaults to off, so nothing is blocked unasked. */
export function readStylusOnly(storage?: Pick<Storage, "getItem">): boolean {
  try {
    return storage?.getItem(STYLUS_ONLY_STORAGE_KEY) === "true";
  } catch {
    // Private mode and blocked storage both throw on access rather than
    // returning null. A preference is not worth failing a mount over.
    return false;
  }
}

export function writeStylusOnly(
  value: boolean,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    storage?.setItem(STYLUS_ONLY_STORAGE_KEY, String(value));
  } catch {
    // As above — the setting simply will not persist.
  }
}

/**
 * Autosave decisions.
 *
 * A tablet session ends by locking the screen or swiping the app away, neither
 * of which runs a save handler reliably, so waiting for an explicit Save is how
 * work gets lost. Saving on every change is the other extreme: Excalidraw fires
 * `onChange` for pointer moves and selection, which would be a write per frame.
 */
export interface AutosaveInput {
  isDirty: boolean;
  isSaving: boolean;
  /** Milliseconds since the last change. */
  idleFor: number;
  /** How long the surface must be still before a save is worth making. */
  idleThreshold: number;
}

export function shouldAutosave({
  isDirty,
  isSaving,
  idleFor,
  idleThreshold,
}: AutosaveInput): boolean {
  if (!isDirty || isSaving) return false;
  return idleFor >= idleThreshold;
}

/** "Saved just now", "Saved 3 minutes ago" — the only save feedback that exists
    once the button stops being the way work is committed. */
export function describeSaveState(options: {
  isSaving: boolean;
  isDirty: boolean;
  savedAt: number | null;
  now?: number;
}): string {
  const { isSaving, isDirty, savedAt } = options;
  const now = options.now ?? Date.now();

  if (isSaving) return "Saving…";
  if (isDirty) return "Unsaved changes";
  if (savedAt === null) return "";

  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 10) return "Saved just now";
  if (seconds < 60) return `Saved ${seconds} seconds ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `Saved ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.round(minutes / 60);
  return `Saved ${hours} hour${hours === 1 ? "" : "s"} ago`;
}
