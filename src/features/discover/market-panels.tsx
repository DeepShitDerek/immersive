"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Coins } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { Sparkline } from "@/features/dashboard/charts";
import { fetchJson } from "./sources";
import {
  cryptoUrl,
  describeSignal,
  formatPercent,
  fxSeriesUrl,
  indicatorUrl,
  INDICATORS,
  parseCoins,
  parseIndicator,
  parseRateSeries,
  sendSignal,
  type Coin,
  type Indicator,
  type RateSeries,
} from "./market";
import { Panel } from "./panel";

/**
 * Money, markets and the job market.
 *
 * Each panel owns its fetch and fails alone — independent services with
 * independent outages, and one being down should cost that panel and nothing
 * else. The dashboard's all-or-nothing batch already taught that lesson at the
 * cost of a blank page.
 *
 * The chart component is borrowed from the dashboard. That is a deliberate
 * cross-feature import of a presentational primitive with no state of its own;
 * a second sparkline here would drift from the first within a month.
 */

type State = "loading" | "done" | "failed";

/* ── Currency corridor ───────────────────────────────────────────────────── */

/**
 * The rate between where you earn and where you send.
 *
 * The most useful thing on this page for anyone supporting family abroad, and
 * the reason it is first: a single rate tells you nothing, but a rate against
 * its own last month tells you whether to send today or wait.
 */
export function CorridorPanel({
  base,
  quote,
}: {
  base: string;
  quote: string;
}) {
  const [series, setSeries] = useState<RateSeries | null>(null);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    void (async () => {
      const body = await fetchJson(fxSeriesUrl(base, quote, 30));
      if (cancelled) return;

      const parsed = parseRateSeries(body, quote);
      setSeries(parsed);
      setState(parsed ? "done" : "failed");
    })();

    return () => {
      cancelled = true;
    };
  }, [base, quote]);

  const signal = series ? sendSignal(series.deviation) : "fair";

  return (
    <Panel title={`${base} → ${quote}`} note="30 days · ECB" state={state}>
      {series && (
        <>
          <div className="mt-1 flex items-baseline gap-2">
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {series.latest.toFixed(2)}
            </p>
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs tabular-nums",
                // Advice, not an error: a poor rate is a reason to wait.
                signal === "good"
                  ? "text-success"
                  : signal === "poor"
                    ? "text-warning"
                    : "text-muted-foreground",
              )}
            >
              {series.deviation >= 0 ? (
                <ArrowUpRight className="size-3" aria-hidden />
              ) : (
                <ArrowDownRight className="size-3" aria-hidden />
              )}
              {formatPercent(series.deviation)}
            </span>
          </div>

          <div className="mt-2">
            <Sparkline
              values={series.values}
              height={44}
              className={signal === "poor" ? "text-warning" : "text-success"}
              label={`${base} to ${quote} over the last 30 days`}
            />
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {describeSignal(signal, quote)}
          </p>
          <p className="mt-0.5 text-micro tabular-nums text-muted-foreground">
            Month low {series.low.toFixed(2)} · high {series.high.toFixed(2)}
          </p>
        </>
      )}
    </Panel>
  );
}

/* ── Crypto ──────────────────────────────────────────────────────────────── */

export function CryptoPanel({ vs = "usd" }: { vs?: string }) {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const body = await fetchJson(cryptoUrl(vs));
      if (cancelled) return;
      if (body === null) {
        setState("failed");
        return;
      }
      setCoins(parseCoins(body, vs));
      setState("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [vs]);

  return (
    <Panel title="Crypto" note="24h" state={state}>
      <ul className="mt-2 space-y-2">
        {coins.map((coin) => (
          <li
            key={coin.id}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="flex items-center gap-1.5 text-sm text-foreground">
              <Coins className="size-3.5 text-muted-foreground" aria-hidden />
              {coin.symbol}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-sm tabular-nums text-foreground">
                {formatMoney(
                  { amount: coin.price, currency: vs.toUpperCase() },
                  { whole: true },
                )}
              </span>
              <span
                className={cn(
                  "w-14 text-right text-xs tabular-nums",
                  coin.change24h >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {formatPercent(coin.change24h)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ── Economy ─────────────────────────────────────────────────────────────── */

export function EconomyPanel({ country }: { country: string }) {
  const [rows, setRows] = useState<Indicator[]>([]);
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const bodies = await Promise.all([
        fetchJson(indicatorUrl(country, INDICATORS.inflation)),
        fetchJson(indicatorUrl(country, INDICATORS.unemployment)),
      ]);
      if (cancelled) return;

      const parsed = bodies
        .map((body) => parseIndicator(body))
        .filter((row): row is Indicator => row !== null);

      setRows(parsed);
      setState(parsed.length > 0 ? "done" : "failed");
    })();

    return () => {
      cancelled = true;
    };
  }, [country]);

  return (
    <Panel
      title="Economy"
      /* Said out loud: these are annual figures published in arrears, and a
         panel that implied otherwise would be worse than no panel. */
      note="World Bank · annual"
      state={state}
    >
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="min-w-0 truncate text-sm text-foreground">
              {row.label.replace(/,.*$/, "")}
            </span>
            <span className="flex shrink-0 items-baseline gap-2">
              <span className="text-sm tabular-nums text-foreground">
                {formatPercent(row.value, 1, false)}
              </span>
              <span className="w-9 text-right text-micro tabular-nums text-muted-foreground">
                {row.year}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
