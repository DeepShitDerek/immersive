"use client";

import dynamic from "next/dynamic";
import { LoadingState } from "@/components/admin/shared";

/**
 * Split because the grid, the recurrence expansion and the four views are a
 * fair amount of code — not because of a library. FullCalendar and its five
 * packages are gone; the grid is this module's own.
 */
const CalendarPage = dynamic(
  () => import("@/features/calendar/calendar-page"),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" label="Loading calendar" />,
  },
);

export default function Page() {
  return <CalendarPage />;
}
