"use client";

import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { VisitorAnalytics, VisitorSlice } from "@/types";
import { analyticsApi } from "@/store/api/admin/analyticsApi";
import AnalyticsPage from "./analytics-page";

/** Placeholder rows: the harness checks layout, not what the numbers say. */
const slices = (prefix: string, n: number): VisitorSlice[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `${prefix} ${i + 1}`,
    value: (n - i) * 7,
  }));

function sample(days: number): VisitorAnalytics {
  const today = new Date();
  const by_day = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      day: d.toISOString().slice(0, 10),
      views: 10 + ((i * 7) % 23),
      visitors: 4 + ((i * 3) % 9),
    };
  });
  const views = by_day.reduce((a, b) => a + b.views, 0);
  return {
    range_days: days,
    total_views: views,
    total_visitors: by_day.reduce((a, b) => a + b.visitors, 0),
    bot_views: 12,
    by_day,
    top_pages: slices("/page", 8),
    top_sources: slices("Source", 5),
    by_channel: slices("Channel", 4),
    by_country: [
      { name: "CA", value: 40, visitors: 20 },
      { name: "GB", value: 22, visitors: 11 },
    ],
    by_city: slices("City", 4).map((s) => ({ ...s, country: null })),
    by_network: slices("Network", 3),
    by_browser: slices("Browser", 4),
    by_os: slices("System", 3),
    by_device: [
      { name: "desktop", value: 60 },
      { name: "mobile", value: 30 },
      { name: "tablet", value: 5 },
    ],
    by_hour: [],
  };
}

/**
 * The real Analytics screen in the workspace frame, its query answered with
 * placeholder numbers for every range, so the layout can be checked in a
 * browser. For looking only: the ⋯ menu's delete would reach the real project.
 */
export function AnalyticsHarness() {
  const dispatch = useDispatch() as (action: unknown) => void;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    for (const days of [7, 30, 90, 365]) {
      for (const withBots of [false, true]) {
        dispatch(
          analyticsApi.util.upsertQueryData(
            "getVisitorAnalytics",
            { days, withBots },
            sample(days),
          ),
        );
      }
    }
    setSeeded(true);
  }, [dispatch]);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          {seeded && <AnalyticsPage />}
        </div>
      </main>
    </div>
  );
}
