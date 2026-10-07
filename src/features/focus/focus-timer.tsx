"use client";

import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, Pause, Play, Square, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  pauseFocus,
  restoreFocus,
  resumeFocus,
  stopFocus,
  syncFocus,
} from "@/store/slices/focusSlice";
import { loadFocus, saveFocus } from "./focus-persistence";
import {
  useAddTaskTimeMutation,
  useLogFocusSessionMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export function FocusTimer() {
  const dispatch = useAppDispatch();
  const { isActive, isPaused, timeLeft, duration, taskTitle, taskId, mode } =
    useAppSelector((state) => state.focus);
  const [logSession] = useLogFocusSessionMutation();
  const [addTaskTime] = useAddTaskTimeMutation();
  const [isMinimized, setIsMinimized] = React.useState(false);

  const focus = useAppSelector((state) => state.focus);

  // A session running before a reload picks up where the clock says it is.
  useEffect(() => {
    const saved = loadFocus();
    if (saved) {
      dispatch(restoreFocus(saved));
      dispatch(syncFocus());
    }
  }, [dispatch]);

  useEffect(() => saveFocus(focus), [focus]);

  // The interval only repaints; the time comes from the clock, so a slowed
  // background tab catches up on its next tick or when it is shown again.
  useEffect(() => {
    if (!isActive || isPaused) return;
    const sync = () => dispatch(syncFocus());
    const interval = setInterval(sync, 1000);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [isActive, isPaused, dispatch]);

  // Completion fires when the countdown reaches zero.
  useEffect(() => {
    if (isActive && !isPaused && timeLeft === 0) handleComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isPaused, timeLeft]);

  /**
   * Record the work that actually happened, then clear the timer.
   *
   * Elapsed time is derived from what is left on the clock rather than assumed
   * to be the full duration, so stopping early logs the minutes worked instead
   * of logging nothing — which is what it used to do. A break is never logged
   * against a task.
   */
  const finishSession = async (reason: "completed" | "stopped") => {
    const elapsedMinutes = Math.round((duration * 60 - timeLeft) / 60);
    const wasWork = mode === "work";
    const trackedTaskId = taskId;

    dispatch(stopFocus());

    if (!wasWork) {
      if (reason === "completed") toast.info("Break over. Back to work!");
      return;
    }

    // Nothing worth recording — a session stopped within the first minute.
    if (elapsedMinutes < 1) {
      if (reason === "completed") toast.success("Focus session complete.");
      return;
    }

    try {
      await logSession({
        duration_minutes: elapsedMinutes,
        task_id: trackedTaskId,
        mode,
      }).unwrap();

      if (trackedTaskId) {
        await addTaskTime({
          taskId: trackedTaskId,
          minutes: elapsedMinutes,
        }).unwrap();
      }

      toast.success(
        reason === "completed"
          ? `Focus session complete — ${elapsedMinutes}m logged.`
          : `${elapsedMinutes}m logged.`,
        trackedTaskId && taskTitle
          ? { description: `Added to "${taskTitle}"` }
          : undefined,
      );
    } catch {
      toast.error("Couldn't log the session.");
    }
  };

  const handleComplete = () => finishSession("completed");

  if (!isActive) return null;

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  // Minimized floating widget (bottom right)
  if (isMinimized) {
    return (
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        // Above the workspace tab bar below lg.
        className="fixed bottom-[calc(var(--tabbar-h)+1rem+env(safe-area-inset-bottom))] right-4 z-overlay lg:bottom-6 lg:right-6"
      >
        <Card className="flex items-center gap-4 border-primary/20 bg-background/80 p-3 shadow-e3 backdrop-blur">
          <div className="flex flex-col">
            <span className="t-micro">
              {mode === "work" ? "Focusing" : "Break"}
            </span>
            <span className="text-xl font-bold tabular-nums">
              {formatTime(timeLeft)}
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              aria-label="Expand focus timer"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setIsMinimized(false)}
            >
              <Maximize2 className="size-4" />
            </Button>
            {isPaused ? (
              <Button
                size="icon"
                aria-label="Resume timer"
                variant="outline"
                className="h-8 w-8"
                onClick={() => dispatch(resumeFocus())}
              >
                <Play className="size-3 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                aria-label="Pause timer"
                variant="outline"
                className="h-8 w-8"
                onClick={() => dispatch(pauseFocus())}
              >
                <Pause className="size-3 fill-current" />
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    );
  }

  // Full-screen focus overlay
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-overlay flex flex-col items-center justify-center bg-background/95 backdrop-blur-md"
      >
        <div className="absolute right-6 top-6">
          <Button variant="ghost" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="mr-2 size-4" /> Minimize
          </Button>
        </div>

        <div className="w-full max-w-md space-y-8 p-6 text-center">
          <div className="space-y-2">
            <h2 className="animate-pulse text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {mode === "work" ? "Deep Work Mode" : "Rest & Recover"}
            </h2>
            <div className="font-heading text-8xl font-black tabular-nums tracking-tighter text-foreground">
              {formatTime(timeLeft)}
            </div>
            {taskTitle && (
              <div className="flex items-center justify-center gap-2 text-xl font-medium text-primary">
                <Zap className="size-5" />
                <span>{taskTitle}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Progress value={progress} className="h-2 w-full" />
            <p className="text-right text-xs text-muted-foreground">
              {Math.round(progress)}% completed
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            {isPaused ? (
              <Button
                size="lg"
                className="h-14 w-32 gap-2 text-lg"
                onClick={() => dispatch(resumeFocus())}
              >
                <Play className="size-5 fill-current" /> Resume
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="h-14 w-32 gap-2 text-lg"
                onClick={() => dispatch(pauseFocus())}
              >
                <Pause className="size-5 fill-current" /> Pause
              </Button>
            )}

            <Button
              size="lg"
              variant="destructive"
              className="h-14 w-32 gap-2 text-lg"
              onClick={() => void finishSession("stopped")}
            >
              <Square className="size-5 fill-current" /> Stop
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
