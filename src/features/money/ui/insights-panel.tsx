"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  OctagonAlert,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { monthBudget, spendingByRoot } from "../domain/budget";
import {
  addDays,
  daysBetween,
  monthKey,
  monthStart,
  yearOf,
} from "../domain/dates";
import { forecast } from "../domain/forecast";
import {
  type Insight,
  type InsightFacts,
  insights,
  type InsightTone,
} from "../domain/insights";
import { creditUtilisation } from "../domain/ledger";
import { convert, money } from "../domain/money";
import { renewalDate } from "../domain/loan";
import {
  lastMonths,
  monthlySeries,
  remittances,
  taxYear,
} from "../domain/reports";
import { flowsByYear, registeredMovements, tfsaRoom } from "../domain/room";
import { dueQueue } from "../domain/schedule";
import { useMoney } from "./money-context";
import type { AreaId } from "./overview-area";

const ICON: Record<InsightTone, typeof Info> = {
  alert: OctagonAlert,
  warn: AlertTriangle,
  good: CheckCircle2,
  info: Info,
};
const TONE_LABEL: Record<InsightTone, string> = {
  alert: "Needs attention",
  warn: "Worth a look",
  good: "Going well",
  info: "Good to know",
};

/** What the numbers are saying, in plain words. */
export function InsightsPanel({ onGo }: { onGo: (area: AreaId) => void }) {
  const m = useMoney();
  const cards = useMemo<Insight[]>(() => {
    const base = m.settings.baseCurrency;
    const lastFull = addDays(monthStart(monthKey(m.today)), -1);
    const [p3, p2, p1, last] = monthlySeries(
      m.transactions,
      lastMonths(lastFull, 4),
    );
    const active = (r: typeof last) =>
      r.incomeMinor !== 0 || r.spendingMinor !== 0;
    const prior = [p1, p2, p3].filter(active);
    const avg = (xs: number[]) =>
      xs.length ? Math.round(xs.reduce((t, x) => t + x, 0) / xs.length) : 0;
    const priorIncome = avg(prior.map((r) => r.incomeMinor));
    const priorSpending = avg(prior.map((r) => r.spendingMinor));
    const spentRecently = [last, ...prior].filter(active);

    // Category jumps, by top-level category.
    const lastByRoot = spendingByRoot(m.transactions, m.categories, last.month);
    const priorByRoot = prior.map((r) =>
      spendingByRoot(m.transactions, m.categories, r.month),
    );
    const categoryChanges = [...lastByRoot].flatMap(([id, lastMinor]) =>
      id && prior.length
        ? [
            {
              name: m.categoryById.get(id)?.name ?? "Uncategorised",
              lastMinor,
              averageMinor: avg(priorByRoot.map((map) => map.get(id) ?? 0)),
            },
          ]
        : [],
    );

    let liquid = 0;
    for (const a of m.openAccounts) {
      if (!a.isLiquid) continue;
      const bal = m.balanceByAccount.get(a.id)?.balanceMinor ?? 0;
      const q =
        a.currency === base
          ? { rate: 1 }
          : m.rateTable.quote(a.currency, base, m.today);
      if (q)
        liquid +=
          a.currency === base
            ? bal
            : convert(money(bal, a.currency), q.rate, base).minor;
    }

    const util = creditUtilisation(m.accounts, m.balanceByAccount);
    const tfsa = tfsaRoom(
      yearOf(m.today),
      m.room,
      flowsByYear(
        registeredMovements("tfsa", m.accounts, m.transactions, base).movements,
      ),
      m.settings.residentSince,
      m.settings.birthYear,
    );
    const thisMonth = monthKey(m.today);
    const cache = new Map<string, Map<string | null, number>>();
    const spendingFor = (month: string) => {
      if (!cache.has(month))
        cache.set(month, spendingByRoot(m.transactions, m.categories, month));
      return cache.get(month)!;
    };
    const overBudget = monthBudget(m.budgets, thisMonth, spendingFor)
      .filter((l) => l.leftMinor < 0)
      .map((l) => ({
        name: m.categoryById.get(l.categoryId)?.name ?? "A category",
        overMinor: -l.leftMinor,
      }));

    const dueThisWeek = dueQueue(
      m.schedules,
      m.transactions,
      m.skips,
      m.today,
      { lookBackDays: 0, lookAheadDays: 7 },
    )
      .filter((d) => d.status !== "overdue")
      .map((d) => ({ name: d.schedule.name, date: d.dueDate }));
    const year = yearOf(m.today);
    const rem = remittances({
      transactions: m.transactions,
      accounts: m.accountById,
      from: `${year}-01-01`,
      to: m.today,
      base,
      rates: m.rateTable,
    });
    const tax = taxYear({
      year,
      accounts: m.accounts,
      transactions: m.transactions,
      trades: m.trades,
      base,
      rates: m.rateTable,
    });
    const renewals = m.loans.flatMap((loan) => {
      const account = m.accountById.get(loan.accountId);
      const date = renewalDate(loan);
      if (!account || account.archivedAt || !date || date <= m.today) return [];
      const days = daysBetween(m.today, date);
      return days <= 120 ? [{ name: account.name, date, days }] : [];
    });
    const stale = new Set<string>();
    for (const pf of m.portfolioByAccount.values())
      for (const h of pf.holdings)
        if (h.units > 0 && (h.priceAgeDays ?? 0) > 30)
          stale.add(h.security.symbol);
    const fc = forecast({
      today: m.today,
      days: 60,
      base,
      accounts: m.accounts,
      balanceByAccount: m.balanceByAccount,
      schedules: m.schedules,
      transactions: m.transactions,
      skips: m.skips,
      rates: m.rateTable,
    });

    const facts: InsightFacts = {
      base,
      lastMonth: active(last)
        ? {
            label: new Date(`${last.month}-01T00:00:00Z`).toLocaleDateString(
              "en-CA",
              { month: "long", timeZone: "UTC" },
            ),
            incomeMinor: last.incomeMinor,
            spendingMinor: last.spendingMinor,
            savingsRate: last.savingsRate,
          }
        : null,
      priorAverage: prior.length
        ? {
            spendingMinor: priorSpending,
            savingsRate: priorIncome
              ? (priorIncome - priorSpending) / priorIncome
              : null,
          }
        : null,
      categoryChanges,
      liquidMinor: liquid,
      averageMonthlySpendingMinor: avg(
        spentRecently.map((r) => r.spendingMinor),
      ),
      cardsOver30: util.cards
        .filter((c) => c.ratio > 0.3)
        .map((c) => ({
          name: m.accountById.get(c.accountId)?.name ?? "A card",
          ratio: c.ratio,
        })),
      tfsaAvailableMinor: tfsa.basis === "unknown" ? null : tfsa.availableMinor,
      overBudget,
      dueThisWeek,
      remittanceCostThisYearMinor: rem.costBaseMinor,
      remittancesThisYear: rem.items.length,
      foreignPropertyPeakMinor: tax.foreignPropertyPeakMinor,
      renewals,
      stalePrices: [...stale],
      forecastBelowZero: fc.firstBelowZero,
    };
    return insights(facts);
  }, [m]);

  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="insights-heading">
      <h2
        id="insights-heading"
        className="mb-3 font-heading text-base font-semibold"
      >
        What stands out
      </h2>
      <ul className="grid gap-3">
        {cards.map((card) => {
          const Icon = ICON[card.tone];
          return (
            <li key={card.id}>
              <button
                type="button"
                onClick={() => onGo(card.area as AreaId)}
                className={cn(
                  "group flex h-full w-full gap-3 rounded-surface border bg-card p-4 text-left transition-colors hover:bg-secondary/40 focus-ring",
                  card.tone === "alert" && "border-destructive/50",
                  card.tone === "warn" && "border-warning/50",
                )}
              >
                <Icon
                  aria-label={TONE_LABEL[card.tone]}
                  className={cn(
                    "mt-0.5 size-5 shrink-0",
                    card.tone === "alert" && "text-destructive",
                    card.tone === "warn" && "text-warning",
                    card.tone === "good" && "text-success",
                    card.tone === "info" && "text-muted-foreground",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {card.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {card.detail}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
