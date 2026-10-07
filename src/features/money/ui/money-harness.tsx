"use client";

import { Suspense, useState } from "react";
import { setBackendForHarness } from "../data/backend";
import { createMemoryBackend } from "../data/memory-backend";
import MoneyPage from "./money-page";

/**
 * The money module against an in-memory ledger kept in localStorage
 *, for exercising every screen in a browser without an admin
 * login or a database. Mounted only by /dev/money in harness builds.
 */
export function MoneyHarness() {
  // Swapped before the first query runs: queries start in effects, after
  // this initialiser.
  useState(() => {
    setBackendForHarness(createMemoryBackend("money-harness"));
    return true;
  });
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <Suspense>
        <MoneyPage basePath="/dev/money/" syncRates={false} />
      </Suspense>
    </div>
  );
}
