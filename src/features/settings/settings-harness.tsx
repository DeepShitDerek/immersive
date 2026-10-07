"use client";

import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { MOCK_SITE_IDENTITY } from "@/lib/fallback-data";
import { siteApi } from "@/store/api/admin/siteApi";
import SettingsPage from "./settings-page";

/**
 * The real Settings screen in the workspace frame, with the settings query
 * answered from the app's own fallback identity instead of Supabase, so the
 * layout can be checked in a browser. Nothing here saves: the harness is
 * for looking, and Save would reach the real database.
 */
export function SettingsHarness() {
  const dispatch = useDispatch();
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    // Cast: the store's dispatch type is not exported to features.
    (dispatch as (action: unknown) => void)(
      siteApi.util.upsertQueryData(
        "getSiteSettings",
        undefined,
        MOCK_SITE_IDENTITY,
      ),
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
          {seeded && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
