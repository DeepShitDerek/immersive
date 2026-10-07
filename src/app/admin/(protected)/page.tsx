"use client";

import dynamic from "next/dynamic";
import LoadingSpinner from "@/components/admin/loading-spinner";

// The overview charts pull in Recharts — keep it out of the admin landing
// chunk and load it alongside the dashboard query, which already spins.
const DashboardPage = dynamic(
  () => import("@/features/dashboard/dashboard-page"),
  {
    ssr: false,
    loading: () => <LoadingSpinner />,
  },
);

export default function Page() {
  return <DashboardPage />;
}
