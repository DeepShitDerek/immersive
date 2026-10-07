import type { FocusState } from "@/store/slices/focusSlice";

/**
 * The running focus session, kept for a reload.
 *
 * sessionStorage rather than localStorage: it is per tab, so two open tabs
 * cannot both finish, and both log, the same session.
 */
const KEY = "focus-session";

export function saveFocus(state: FocusState): void {
  try {
    if (state.isActive) sessionStorage.setItem(KEY, JSON.stringify(state));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the session lasts until the page does, as before.
  }
}

export function loadFocus(): FocusState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as FocusState;
    const valid =
      state?.isActive === true &&
      typeof state.duration === "number" &&
      (state.isPaused
        ? typeof state.pausedRemaining === "number"
        : typeof state.endsAt === "number");
    return valid ? state : null;
  } catch {
    return null;
  }
}
