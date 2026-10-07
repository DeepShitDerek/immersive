import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarHarness } from "@/features/calendar/calendar-harness";

/**
 * Dev-only harness for the Calendar, without a sign-in. Exists only in builds
 * made with NEXT_PUBLIC_DEV_HARNESS=1; every other build answers 404.
 */
export const metadata: Metadata = {
  title: "Calendar harness",
  robots: { index: false, follow: false },
};

export default function Page() {
  if (process.env.NEXT_PUBLIC_DEV_HARNESS !== "1") notFound();
  // Hooks read the URL; under static export that needs Suspense.
  return (
    <Suspense>
      <CalendarHarness />
    </Suspense>
  );
}
