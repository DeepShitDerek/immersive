"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { rateSyncPlan } from "../domain/fx-history";
import { fetchSeries, hasPublishedRate } from "../data/rate-source";
import { useSaveRatesMutation } from "../data/money-api";
import { useMoney } from "./money-context";

/** The currencies the owner's money is in, other than the base. */
export function useCurrenciesInUse(): string[] {
  const { settings, accounts } = useMoney();
  return useMemo(
    () =>
      [...new Set([settings.homeCurrency, ...accounts.map((a) => a.currency)])]
        .filter((c) => c !== settings.baseCurrency)
        .sort(),
    [accounts, settings.homeCurrency, settings.baseCurrency],
  );
}

/**
 * Brings the stored exchange rates up to today, and a year back for the
 * graph. Rates are the central bank's daily reference rates: one a working
 * day, so "up to date" means today's, or the last working day's.
 *
 * `run` resolves to how many rates were saved, or null if the source could
 * not be reached.
 */
export function useRateSync() {
  const { settings, rates, today } = useMoney();
  const used = useCurrenciesInUse();
  const [saveRates] = useSaveRatesMutation();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const base = settings.baseCurrency;

  const run = useCallback(async (): Promise<number | null> => {
    const plan = hasPublishedRate(base)
      ? rateSyncPlan({
          base,
          quotes: used.filter(hasPublishedRate),
          rows: rates,
          today,
        })
      : null;
    if (!plan) return 0;
    setState("busy");
    try {
      const rows = await fetchSeries(base, plan.quotes, plan.from);
      if (rows.length > 0) {
        await saveRates(rows.map((r) => ({ ...r, source: "ecb" }))).unwrap();
      }
      setState("idle");
      return rows.length;
    } catch {
      setState("failed");
      return null;
    }
  }, [base, used, rates, today, saveRates]);

  return { run, state };
}

/**
 * Updates the rates once when the money module opens, so no screen shows a
 * stale conversion and nobody has to ask for the latest. Silent: a failure
 * leaves the stored rates in use, and Settings says how old they are.
 */
export function RateSync() {
  const { run } = useRateSync();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);
  return null;
}
