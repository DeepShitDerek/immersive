"use client";

import { useState } from "react";
import { Loader2, Play, Square, Timer, X } from "lucide-react";
import { toast } from "sonner";
import type { LearningTopic } from "@/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  sessionStarted,
  sessionStopped,
} from "@/store/slices/learningSessionSlice";
import {
  useAddLearningSessionMutation,
  useDeleteLearningSessionMutation,
  useUpdateLearningSessionMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";

interface SessionTrackerProps {
  topic: LearningTopic | null;
}

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

export function SessionTracker({ topic }: SessionTrackerProps) {
  const confirm = useConfirm();

  const [journalNotes, setJournalNotes] = useState("");
  const dispatch = useAppDispatch();
  const { activeSession, elapsedTime } = useAppSelector(
    (state) => state.learningSession,
  );

  const [startSessionMutation, { isLoading: isStarting }] =
    useAddLearningSessionMutation();
  const [stopSessionMutation, { isLoading: isStopping }] =
    useUpdateLearningSessionMutation();
  const [cancelSessionMutation, { isLoading: isCancelling }] =
    useDeleteLearningSessionMutation();
  const isLoading = isStarting || isStopping || isCancelling;

  const handleStart = async () => {
    if (!topic) return;
    if (activeSession) {
      toast.warning("Another session is already active.", {
        description:
          "Please stop the current session before starting a new one.",
      });
      return;
    }
    try {
      const newSession = await startSessionMutation({
        topic_id: topic.id,
        start_time: new Date().toISOString(),
      }).unwrap();

      // Redux state drives the global LearningSessionManager timer
      dispatch(sessionStarted(newSession));

      toast.success(`Session started for "${topic.title}"`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to start session");
    }
  };

  const handleStop = async () => {
    if (!activeSession) return;
    const endTime = new Date();
    const duration_minutes = Math.max(
      1,
      Math.round(
        (endTime.getTime() - new Date(activeSession.start_time).getTime()) /
          60000,
      ),
    );
    try {
      await stopSessionMutation({
        id: activeSession.id,
        end_time: endTime.toISOString(),
        duration_minutes,
        journal_notes: journalNotes || null,
      }).unwrap();

      dispatch(sessionStopped());

      toast.success(`Session saved! Duration: ${duration_minutes} min.`);
      setJournalNotes("");
    } catch {
      toast.error("Failed to stop session");
    }
  };

  const handleCancel = async () => {
    if (!activeSession) return;

    const ok = await confirm({
      title: "Discard Session?",
      description:
        "This will delete the current session time and notes permanently.",
      variant: "destructive",
      confirmText: "Discard",
    });

    if (!ok) return;

    try {
      await cancelSessionMutation(activeSession.id).unwrap();

      dispatch(sessionStopped());

      toast.warning("Session cancelled and deleted.");
      setJournalNotes("");
    } catch {
      toast.error("Failed to cancel session");
    }
  };

  if (!topic) return null;
  const isCurrentTopicSessionActive = activeSession?.topic_id === topic.id;

  return (
    <div className="space-y-4 rounded-surface border bg-secondary/30 p-4">
      <h4 className="flex items-center gap-2 font-semibold text-foreground">
        <Timer className="size-5 text-primary" />
        <span>Learning Session</span>
      </h4>
      {isCurrentTopicSessionActive ? (
        <div className="flex items-center justify-between rounded-md bg-background p-3">
          <p className="text-2xl font-bold tabular-nums tracking-wider text-primary">
            {formatTime(elapsedTime || 0)}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleCancel}
              disabled={isLoading}
              variant="ghost"
              size="sm"
            >
              <X className="size-4" />
            </Button>
            <Button
              onClick={handleStop}
              disabled={isLoading}
              variant="destructive"
              size="sm"
            >
              {isLoading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Square className="size-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={handleStart}
          disabled={isLoading || !!activeSession}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Play className="mr-2 size-4" />
          )}{" "}
          Start New Session
        </Button>
      )}
      {isCurrentTopicSessionActive && (
        <div className="space-y-2">
          <Label htmlFor="journal-notes">Session Journal</Label>
          <Textarea
            id="journal-notes"
            value={journalNotes}
            onChange={(e) => setJournalNotes(e.target.value)}
            placeholder="What did you learn or struggle with?"
            rows={4}
          />
        </div>
      )}
    </div>
  );
}
