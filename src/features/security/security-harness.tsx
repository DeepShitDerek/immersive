"use client";

import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import type { Factor } from "@supabase/supabase-js";
import { authApi } from "@/store/api/admin/authApi";
import { siteApi } from "@/store/api/admin/siteApi";
import SecurityPage from "./security-page";

/** One verified authenticator: the state that shows the "add a second" nudge. */
const FACTORS = [
  {
    id: "harness-factor",
    friendly_name: "Authenticator app",
    factor_type: "totp",
    status: "verified",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
  },
] as unknown as Factor[];

/**
 * The real Security screen in the workspace frame, with its two queries
 * answered in memory instead of Supabase, so the layout can be checked in a
 * browser. For looking only: every button here would reach the real
 * project.
 */
export function SecurityHarness() {
  const dispatch = useDispatch() as (action: unknown) => void;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    dispatch(authApi.util.upsertQueryData("getMfaFactors", undefined, FACTORS));
    dispatch(
      siteApi.util.upsertQueryData("getSecuritySettings", undefined, {
        lockdown_level: 0,
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
          {seeded && <SecurityPage />}
        </div>
      </main>
    </div>
  );
}
