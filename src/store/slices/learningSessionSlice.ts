import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { LearningSession } from "@/types";

interface LearningSessionState {
  activeSession: LearningSession | null;
  elapsedTime: number | null;
  isLoading: boolean;
}

const initialState: LearningSessionState = {
  activeSession: null,
  elapsedTime: null,
  isLoading: false,
};

const learningSessionSlice = createSlice({
  name: "learningSession",
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    sessionStarted: (state, action: PayloadAction<LearningSession>) => {
      state.activeSession = action.payload;
      state.isLoading = false;
    },
    sessionStopped: (state) => {
      state.activeSession = null;
      state.elapsedTime = null;
      state.isLoading = false;
    },
    tick: (state) => {
      if (state.activeSession) {
        const start = new Date(state.activeSession.start_time).getTime();
        state.elapsedTime = Math.floor((new Date().getTime() - start) / 1000);
      }
    },
  },
});

export const { sessionStarted, sessionStopped, tick } =
  learningSessionSlice.actions;

export default learningSessionSlice.reducer;
