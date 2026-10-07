import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { sessionStarted, tick } from "@/store/slices/learningSessionSlice";
import type { LearningSession } from "@/types";

const SESSION_KEY = "activeLearningSession";

// This is now a "headless" component that bridges Redux state with localStorage and API calls.
export const LearningSessionManager = () => {
  const dispatch = useAppDispatch();
  const { activeSession } = useAppSelector((state) => state.learningSession);

  // On mount, check localStorage for a session and initialize the store
  useEffect(() => {
    try {
      const savedSessionJSON = localStorage.getItem(SESSION_KEY);
      if (savedSessionJSON) {
        const savedSession = JSON.parse(savedSessionJSON) as LearningSession;
        if (savedSession?.start_time) {
          dispatch(sessionStarted(savedSession));
        }
      }
    } catch (error) {
      console.error("Failed to parse session from localStorage", error);
      localStorage.removeItem(SESSION_KEY);
    }
  }, [dispatch]);

  // Handle the timer interval
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (activeSession) {
      dispatch(tick()); // Dispatch immediately to avoid 1s delay
      interval = setInterval(() => {
        dispatch(tick());
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession, dispatch]);

  // Sync Redux state changes to localStorage and API
  useEffect(() => {
    const handleSessionChange = async () => {
      if (activeSession) {
        // If a session starts, it's already been added to the DB by the component that called the mutation.
        // We just need to save it to localStorage.
        localStorage.setItem(SESSION_KEY, JSON.stringify(activeSession));
      } else {
        // Session has been stopped or cancelled.
        const existingSession = localStorage.getItem(SESSION_KEY);
        if (existingSession) {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    };
    handleSessionChange();
  }, [activeSession]);

  return null;
};
