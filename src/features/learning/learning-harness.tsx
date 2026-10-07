"use client";

import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { LearningSubject, LearningTopic } from "@/types";
import { learningApi } from "@/store/api/admin/learningApi";
import LearningPage from "./learning-page";

/** Placeholder rows: the harness checks layout, not a curriculum. */
const SUBJECTS = [
  { id: "m1", name: "Sample module 1" },
  { id: "m2", name: "Sample module 2" },
] as LearningSubject[];
const TOPICS: LearningTopic[] = Array.from({ length: 8 }, (_, i) => ({
  id: `t${i}`,
  subject_id: i < 3 ? "m1" : i < 6 ? "m2" : null,
  title: `Sample topic ${i + 1}`,
  status: (["To Learn", "Learning", "Practicing", "Mastered"] as const)[i % 4],
  // Half are due today, half are new, so Today has a queue.
  due_date: i % 2 ? "2026-01-01" : null,
  last_reviewed_at: i % 2 ? "2025-12-20T10:00:00Z" : null,
  interval_days: i % 2 ? 3 : null,
  core_notes: "Notes for the topic.",
})) as LearningTopic[];

/**
 * The real Learning screen in the workspace frame, its query answered in
 * memory, so the layout can be checked in a browser. For looking only:
 * rating a review or deleting would reach the real project.
 */
export function LearningHarness() {
  const dispatch = useDispatch() as (action: unknown) => void;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    dispatch(
      learningApi.util.upsertQueryData("getLearningData", undefined, {
        subjects: SUBJECTS,
        topics: TOPICS,
        sessions: [],
        reviews: [],
      }),
    );
    setSeeded(true);
  }, [dispatch]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          {seeded && <LearningPage />}
        </div>
      </main>
    </div>
  );
}
