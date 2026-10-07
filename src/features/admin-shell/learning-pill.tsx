"use client";

import Link from "next/link";
import { Loader2, Timer } from "lucide-react";
import { useAppSelector } from "@/store/hooks";
import { useGetLearningDataQuery } from "@/store/api/adminApi";
import { isSupabaseConfigured } from "@/lib/config";

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Live study-session indicator; renders nothing when no session is active. */
export function LearningPill() {
  const { activeSession, elapsedTime } = useAppSelector(
    (state) => state.learningSession,
  );
  const { data: learningData } = useGetLearningDataQuery(undefined, {
    skip: !isSupabaseConfigured,
  });

  if (!activeSession) return null;

  const topicName =
    learningData?.topics.find((t) => t.id === activeSession.topic_id)?.title ??
    "Session";

  return (
    <Link
      href="/admin/learning"
      className="flex items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-primary transition-colors hover:bg-primary/20"
    >
      <Timer
        className="size-4 animate-pulse motion-reduce:animate-none"
        aria-hidden
      />
      <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
        {topicName}
      </span>
      {elapsedTime === null ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <span className="text-sm tabular-nums">
          {formatElapsed(elapsedTime)}
        </span>
      )}
    </Link>
  );
}
