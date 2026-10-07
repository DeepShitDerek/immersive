"use client";

import { Suspense } from "react";
import InboxPage from "@/features/inbox/inbox-page";

// The open item lives in the query string; useSearchParams needs a
// Suspense boundary under static export.
export default function Page() {
  return (
    <Suspense>
      <InboxPage />
    </Suspense>
  );
}
