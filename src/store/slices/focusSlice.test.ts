import { afterEach, describe, expect, it, vi } from "vitest";
import reducer, {
  initialFocusState,
  pauseFocus,
  resumeFocus,
  startFocus,
  syncFocus,
} from "./focusSlice";
import { loadFocus, saveFocus } from "@/features/focus/focus-persistence";

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

const at = (ms: number) => vi.setSystemTime(ms);

describe("focus timer runs on the wall clock", () => {
  it("counts real time, however rarely it is ticked", () => {
    vi.useFakeTimers();
    at(0);
    let state = reducer(initialFocusState, startFocus({ durationMinutes: 25 }));
    // A background tab that ticked once in ten minutes.
    at(10 * 60_000);
    state = reducer(state, syncFocus());
    expect(state.timeLeft).toBe(15 * 60);
    at(30 * 60_000);
    state = reducer(state, syncFocus());
    expect(state.timeLeft).toBe(0);
  });

  it("stands still while paused", () => {
    vi.useFakeTimers();
    at(0);
    let state = reducer(initialFocusState, startFocus({ durationMinutes: 25 }));
    at(5 * 60_000);
    state = reducer(state, pauseFocus());
    at(60 * 60_000);
    state = reducer(state, syncFocus());
    expect(state.timeLeft).toBe(20 * 60);
    state = reducer(state, resumeFocus());
    at(61 * 60_000);
    state = reducer(state, syncFocus());
    expect(state.timeLeft).toBe(19 * 60);
  });

  it("is kept for a reload, and forgotten once stopped", () => {
    vi.useFakeTimers();
    at(0);
    const running = reducer(
      initialFocusState,
      startFocus({ durationMinutes: 25, taskId: "t1" }),
    );
    saveFocus(running);
    expect(loadFocus()).toEqual(running);
    saveFocus(initialFocusState);
    expect(loadFocus()).toBeNull();
    sessionStorage.setItem("focus-session", "{bad");
    expect(loadFocus()).toBeNull();
  });
});
