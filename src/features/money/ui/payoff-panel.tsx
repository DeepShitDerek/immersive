"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMonths } from "../domain/dates";
import { convert, money, parseAmount } from "../domain/money";
import { CREDIT_KINDS, isLiability } from "../domain/ledger";
import {
  type Debt,
  paymentsPerYear,
  planPayoff,
  scheduledPayment,
} from "../domain/loan";
import { revolvingPayment } from "../domain/qualify";
import { Amount } from "./amount";
import { useMoney } from "./money-context";

/**
 * Clearing several debts with one monthly amount, both ways:
 * highest interest first (least interest paid) and smallest balance first
 * (quickest wins). In the base currency, at today's rates.
 */
export function PayoffPanel() {
  const {
    openAccounts,
    balanceByAccount,
    loanByAccount,
    settings,
    rateTable,
    today,
  } = useMoney();
  const base = settings.baseCurrency;

  const debts = useMemo(() => {
    const list: (Debt & { rateKnown: boolean })[] = [];
    for (const account of openAccounts) {
      if (!isLiability(account.kind)) continue;
      const owed = Math.max(
        0,
        -(balanceByAccount.get(account.id)?.balanceMinor ?? 0),
      );
      if (owed === 0) continue;
      const quote = rateTable.quote(account.currency, base, today);
      if (!quote) continue;
      const loan = loanByAccount.get(account.id);
      const rate = loan?.annualRate ?? account.interestRate;
      let minimum = CREDIT_KINDS.includes(account.kind)
        ? Math.max(1000, revolvingPayment(owed))
        : 0;
      if (loan)
        minimum = Math.round(
          (scheduledPayment(loan) * paymentsPerYear(loan.frequency)) / 12,
        );
      list.push({
        id: account.id,
        name: account.name,
        balanceMinor: convert(money(owed, account.currency), quote.rate, base)
          .minor,
        annualRate: rate ?? 0,
        minimumPaymentMinor: convert(
          money(Math.min(minimum, owed), account.currency),
          quote.rate,
          base,
        ).minor,
        rateKnown: rate != null,
      });
    }
    return list;
  }, [openAccounts, balanceByAccount, loanByAccount, rateTable, base, today]);

  const minimums = debts.reduce((t, d) => t + d.minimumPaymentMinor, 0);
  const [budgetText, setBudgetText] = useState("");
  const budget = (() => {
    try {
      return budgetText.trim() ? parseAmount(budgetText, base).minor : minimums;
    } catch {
      return minimums;
    }
  })();

  const avalanche = useMemo(
    () => planPayoff(debts, budget, "avalanche"),
    [debts, budget],
  );
  const snowball = useMemo(
    () => planPayoff(debts, budget, "snowball"),
    [debts, budget],
  );
  const name = (id: string) => debts.find((d) => d.id === id)?.name ?? id;

  if (debts.length === 0) {
    return (
      <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
        No debts with a balance. Nothing to pay down.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <ul className="divide-y rounded-surface border bg-card text-sm">
        {debts.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="flex-1 font-medium">{d.name}</span>
            <span className="text-muted-foreground">
              {d.rateKnown ? `${d.annualRate}%` : "rate not set"}
            </span>
            <Amount
              minor={d.balanceMinor}
              currency={base}
              className="w-28 text-right"
            />
            <span className="w-32 text-right text-xs text-muted-foreground">
              min <Amount minor={d.minimumPaymentMinor} currency={base} />
              /mo
            </span>
          </li>
        ))}
      </ul>
      {debts.some((d) => !d.rateKnown) && (
        <p className="text-xs text-warning">
          Set each card&apos;s interest rate on its account (or the loan&apos;s
          terms) — without it the plan treats that debt as interest-free.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="payoff-budget">
            Put towards debt each month ({base})
          </Label>
          <Input
            id="payoff-budget"
            inputMode="decimal"
            value={budgetText}
            onChange={(e) => setBudgetText(e.target.value)}
            placeholder={(minimums / 100).toFixed(2)}
            className="w-40"
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          Minimums add up to <Amount minor={minimums} currency={base} />.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["Highest interest first", "Pays the least interest.", avalanche],
            ["Smallest balance first", "Clears whole debts soonest.", snowball],
          ] as const
        ).map(([title, blurb, plan]) => (
          <section
            key={title}
            className="rounded-surface border bg-card p-5"
            aria-label={title}
          >
            <h3 className="font-heading text-base font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{blurb}</p>
            {plan.feasible ? (
              <>
                <p className="mt-3 text-sm">
                  Debt-free by <strong>{addMonths(today, plan.months)}</strong>{" "}
                  ({plan.months} months), paying{" "}
                  <Amount
                    minor={plan.totalInterestMinor}
                    currency={base}
                    className="font-semibold"
                  />{" "}
                  in interest.
                </p>
                <ol className="mt-3 space-y-1 text-sm">
                  {plan.order.map((o, i) => (
                    <li key={o.id}>
                      {i + 1}. {name(o.id)}{" "}
                      <span className="text-muted-foreground">
                        — cleared in month {o.month}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {plan.reason}
              </p>
            )}
          </section>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Uses each debt&apos;s rate as simple monthly interest and assumes no new
        borrowing. A plan, not a promise.
      </p>
    </div>
  );
}
