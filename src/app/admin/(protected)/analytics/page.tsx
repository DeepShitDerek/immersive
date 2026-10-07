"use client";

import dynamic from "next/dynamic";
import { LoadingState } from "@/components/admin/shared";

/**
 * Split because of Recharts. The dashboard and finance routes already pay for
 * it behind their own boundaries; loading it eagerly here would put it in this
 * route's first load for a page that renders a loading state first anyway.
 */
const AnalyticsPage = dynamic(
  () => import("@/features/analytics/analytics-page"),
  {
    ssr: false,
    loading: () => <LoadingState variant="page" label="Loading analytics" />,
  },
);

export default function Page() {
  return <AnalyticsPage />;
}
