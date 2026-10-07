"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/utils";
import { isIsoDate } from "../domain/dates";
import { quoteAge } from "../domain/fx";
import {
  RATE_RANGES,
  rangeStart,
  rateHistory,
  rateSummary,
  type RateRangeId,
} from "../domain/fx-history";
import { hasPublishedRate } from "../data/rate-source";
import { useSaveRatesMutation } from "../data/money-api";
import { ALL_CURRENCIES } from "./labels";
import { LineChart } from "./line-chart";
import { useMoney } from "./money-context";
import { useCurrenciesInUse, useRateSync } from "./rate-sync";

/** Enough digits to see a small currency move: 61.92, 0.7312, 0.01615. */
const formatRate = (rate: number) =>
  rate >= 10
    ? rate.toFixed(2)
    : rate >= 0.1
      ? rate.toFixed(4)
      : rate.toPrecision(4);

/**
 * Exchange rates: the ECB's published reference rates for every currency
 * the owner's accounts use, kept up to date when the module opens, with how
 * each has moved; or typed in for the ones the ECB does not publish.
 */
export function RatesPanel() {
  const { settings, rateTable, today } = useMoney();
  const used = useCurrenciesInUse();
  const { run, state } = useRateSync();

  const update = async () => {
    const saved = await run();
    if (saved === null) {
      toast.error(
        "Couldn't reach the rate source. The stored rates are still in use.",
      );
    } else {
      toast.success(
        saved
          ? `Saved ${saved} rate${saved === 1 ? "" : "s"}`
          : "Rates are up to date",
      );
    }
  };

  return (
    <section aria-labelledby="rates-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="rates-heading" className="font-heading text-lg font-semibold">
            Exchange rates
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            European Central Bank reference rates, updated when you open Money.
            They are published once each working day and are the mid-market
            rate, not what a bank gives you. Each transaction keeps the rate
            from its own day.
          </p>
        </div>
        {used.some(hasPublishedRate) && (
          <Button
            variant="outline"
            size="sm"
            onClick={update}
            disabled={state === "busy"}
          >
            {state === "busy" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Check now
          </Button>
        )}
      </div>

      {used.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          All your accounts are in {settings.baseCurrency}; no rates needed.
        </p>
      ) : (
        <>
          <RateGraph currencies={used} />
          <ul className="divide-y rounded-surface border bg-card text-sm">
            {used.map((currency) => {
              const quote = rateTable.quote(
                currency,
                settings.baseCurrency,
                today,
              );
              const inverse = rateTable.quote(
                settings.baseCurrency,
                currency,
                today,
              );
              return (
                <li
                  key={currency}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                >
                  <span className="w-12 font-medium">{currency}</span>
                  <span className="flex-1 text-muted-foreground">
                    {quote && inverse
                      ? `1 ${settings.baseCurrency} = ${inverse.rate.toFixed(4)} ${currency} · as of ${quote.asOf}${quoteAge(quote, today) > 4 ? " (stale)" : ""}`
                      : hasPublishedRate(currency)
                        ? state === "busy"
                          ? "Fetching…"
                          : "No rate yet."
                        : "Not published by the ECB — enter it below."}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <ManualRate currencies={used} />
    </section>
  );
}

/** How one currency has moved against the base, over a chosen stretch. */
function RateGraph({ currencies }: { currencies: string[] }) {
  const { settings, rates, today } = useMoney();
  const base = settings.baseCurrency;
  const [chosen, setChosen] = useState(currencies[0]);
  const [range, setRange] = useState<RateRangeId>("3m");
  const currency = currencies.includes(chosen) ? chosen : currencies[0];

  const points = useMemo(
    () => rateHistory(rates, base, currency, rangeStart(range, today), today),
    [rates, base, currency, range, today],
  );
  const summary = rateSummary(points);
  const rangeName = RATE_RANGES.find((r) => r.id === range)!.name;

  return (
    <div className="space-y-3 rounded-surface border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-base font-semibold">
            {currency} per 1 {base}
          </h3>
          {currencies.length > 1 && (
            <Select value={currency} onValueChange={setChosen}>
              <SelectTrigger
                aria-label="Currency to graph"
                className="h-8 w-24"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div
          role="group"
          aria-label="Period"
          className="flex gap-0.5 rounded-control border p-0.5"
        >
          {RATE_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={range === r.id}
              aria-label={r.name}
              onClick={() => setRange(r.id)}
              className={cn(
                "min-h-8 min-w-10 rounded-sm px-2.5 text-xs font-medium focus-ring",
                range === r.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {summary ? (
        <>
          <p className="text-sm">
            <span className="text-lg font-semibold tabular-nums">
              {formatRate(summary.last)}
            </span>{" "}
            <span
              className={cn(
                "tabular-nums",
                summary.changePct > 0
                  ? "text-success"
                  : summary.changePct < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {summary.changePct > 0 ? "+" : ""}
              {summary.changePct.toFixed(2)}%
            </span>{" "}
            <span className="text-muted-foreground">
              over {rangeName} · low {formatRate(summary.low)} · high{" "}
              {formatRate(summary.high)}
            </span>
          </p>
          <LineChart
            points={points.map((p) => ({ date: p.date, valueMinor: p.rate }))}
            currency={currency}
            format={formatRate}
            fromZero={false}
            label={`${currency} per 1 ${base} over ${rangeName}`}
          />
          <p className="text-xs text-muted-foreground">
            Higher means one {base} buys more {currency}.
          </p>
        </>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {hasPublishedRate(currency)
            ? `Not enough ${currency} rates stored for this period yet.`
            : `The ECB does not publish ${currency}. Rates you enter below are graphed once there are two.`}
        </p>
      )}
    </div>
  );
}

function ManualRate({ currencies }: { currencies: string[] }) {
  const { settings, today } = useMoney();
  const [saveRates, saving] = useSaveRatesMutation();
  const [quote, setQuote] = useState(currencies[0] ?? "INR");
  const [date, setDate] = useState(today);
  const [rate, setRate] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(rate);
    if (
      !isIsoDate(date) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      quote === settings.baseCurrency
    ) {
      toast.error("Enter a date and a positive rate.");
      return;
    }
    try {
      await saveRates([
        {
          base: settings.baseCurrency,
          quote,
          asOf: date,
          rate: value,
          source: "manual",
        },
      ]).unwrap();
      toast.success("Rate saved");
      setRate("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded-surface border bg-card p-4"
      noValidate
    >
      <p className="w-full text-sm font-medium">Enter a rate by hand</p>
      <div className="space-y-1">
        <Label htmlFor="rate-quote" className="text-xs">
          Currency
        </Label>
        <Select value={quote} onValueChange={setQuote}>
          <SelectTrigger id="rate-quote" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_CURRENCIES.filter((c) => c !== settings.baseCurrency).map(
              (c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="rate-date" className="text-xs">
          Date
        </Label>
        <Input
          id="rate-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="rate-value" className="text-xs">
          {quote} per 1 {settings.baseCurrency}
        </Label>
        <Input
          id="rate-value"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="w-32"
        />
      </div>
      <Button type="submit" variant="outline" disabled={saving.isLoading}>
        Save rate
      </Button>
    </form>
  );
}
