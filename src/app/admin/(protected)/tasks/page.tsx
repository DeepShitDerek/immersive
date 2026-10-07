"use client";

import { Suspense } from "react";
import TasksPage from "@/features/tasks/tasks-page";

// The open item lives in the query string; useSearchParams needs a
// Suspense boundary under static export.
export default function Page() {
  return (
    <Suspense>
      <TasksPage />
    </Suspense>
  );
}
