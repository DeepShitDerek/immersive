import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type FocusMode = "work" | "break";

/**
 * The focus timer runs on the wall clock.
 *
 * It used to count `setInterval` ticks, and browsers slow timers in a
 * background tab to one a minute or less, so a 25-minute session ran long
 * whenever you looked away. Now the session stores when it ends; `timeLeft`
 * is derived from that by `syncFocus` and is only a cached value for display.
 * Being plain data, the session also survives a reload (see
 * `focus-persistence.ts`).
 */
export interface FocusState {
  isActive: boolean;
  isPaused: boolean;
  mode: FocusMode;
  /** Seconds left, as of the last sync. */
  timeLeft: number;
  /** Minutes, as started. */
  duration: number;
  /** Epoch ms the session ends while running; null while paused. */
  endsAt: number | null;
  /** Ms left when paused. */
  pausedRemaining: number | null;
  taskTitle: string | null;
  taskId: string | null;
}

export const initialFocusState: FocusState = {
  isActive: false,
  isPaused: false,
  mode: "work",
  timeLeft: 25 * 60,
  duration: 25,
  endsAt: null,
  pausedRemaining: null,
  taskTitle: null,
  taskId: null,
};

const secondsLeft = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
const withNow = <P>(payload: P) => ({
  payload: { ...payload, now: Date.now() },
});

const focusSlice = createSlice({
  name: "focus",
  initialState: initialFocusState,
  reducers: {
    startFocus: {
      reducer: (
        state,
        action: PayloadAction<{
          durationMinutes: number;
          taskTitle?: string;
          taskId?: string;
          now: number;
        }>,
      ) => {
        const { durationMinutes, taskTitle, taskId, now } = action.payload;
        state.isActive = true;
        state.isPaused = false;
        state.mode = "work";
        state.duration = durationMinutes;
        state.timeLeft = durationMinutes * 60;
        state.endsAt = now + durationMinutes * 60_000;
        state.pausedRemaining = null;
        state.taskTitle = taskTitle || null;
        state.taskId = taskId || null;
      },
      prepare: (payload: {
        durationMinutes: number;
        taskTitle?: string;
        taskId?: string;
      }) => withNow(payload),
    },
    pauseFocus: {
      reducer: (state, action: PayloadAction<{ now: number }>) => {
        if (!state.isActive || state.isPaused || state.endsAt === null) return;
        const remaining = Math.max(0, state.endsAt - action.payload.now);
        state.isPaused = true;
        state.pausedRemaining = remaining;
        state.endsAt = null;
        state.timeLeft = secondsLeft(remaining);
      },
      prepare: () => withNow({}),
    },
    resumeFocus: {
      reducer: (state, action: PayloadAction<{ now: number }>) => {
        if (!state.isActive || !state.isPaused) return;
        state.isPaused = false;
        state.endsAt =
          action.payload.now + (state.pausedRemaining ?? state.timeLeft * 1000);
        state.pausedRemaining = null;
      },
      prepare: () => withNow({}),
    },
    stopFocus: () => initialFocusState,
    /** Recompute `timeLeft` from the clock. */
    syncFocus: {
      reducer: (state, action: PayloadAction<{ now: number }>) => {
        if (!state.isActive || state.isPaused || state.endsAt === null) return;
        state.timeLeft = secondsLeft(state.endsAt - action.payload.now);
      },
      prepare: () => withNow({}),
    },
    /** A session read back after a reload. */
    restoreFocus: (_state, action: PayloadAction<FocusState>) => action.payload,
  },
});

export const {
  startFocus,
  pauseFocus,
  resumeFocus,
  stopFocus,
  syncFocus,
  restoreFocus,
} = focusSlice.actions;
export default focusSlice.reducer;
