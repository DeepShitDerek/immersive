"use client";

import { useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { daysBetween, isIsoDate, yearOf } from "../domain/dates";
import { emptyEntry, type EntryForm } from "../domain/entry";
import { everydayAccount } from "../domain/ledger";
import {
  projectFromBalance,
  renewalDate,
  scheduledPayment,
  splitPayment,
} from "../domain/loan";
import { money, parseAmount, toInputString } from "../domain/money";
import type { AccountRecord, Loan } from "../data/rows";
import { Amount } from "./amount";
import { FREQUENCY_TEXT, LoanSheet } from "./loan-sheet";
import { useMoney } from "./money-context";
import { TransactionSheet } from "./transaction-sheet";

/**
 * Every loan, mortgage and line of credit: what is owed, on what
 * terms, when it ends, and what paying more would change.
 */
export function LoansPanel() {
  const {
    openAccounts,
    loanByAccount,
    balanceByAccount,
    today,
    categories,
    settings,
  } = useMoney();
  const [editing, setEditing] = useState<AccountRecord | null>(null);
  const [paying, setPaying] = useState<EntryForm | null>(null);
  const debts = openAccounts.filter(
    (a) =>
      a.kind === "loan" || a.kind === "mortgage" || a.kind === "line_of_credit",
  );
  const interestCategory =
    categories.find(
      (c) => !c.archivedAt && /interest/i.test(c.name) && c.bucket !== "income",
    )?.id ?? null;

  const recordPayment = (account: AccountRecord, loan: Loan) => {
    const owed = Math.max(
      0,
      -(balanceByAccount.get(account.id)?.balanceMinor ?? 0),
    );
    // The last payment is smaller: splitPayment caps the principal at what is owed.
    const split = splitPayment(
      owed,
      loan.annualRate,
      loan.compounding,
      loan.frequency,
      scheduledPayment(loan),
    );
    const from = everydayAccount(
      openAccounts.filter(
        (a) => a.currency === account.currency && a.id !== account.id,
      ),
      settings.baseCurrency,
    );
    setPaying({
      ...emptyEntry(today, from?.id ?? ""),
      kind: "transfer",
      description: `${account.name} payment`,
      fromAccountId: from?.id ?? "",
      toAccountId: account.id,
      amountOut: toInputString(money(split.principalMinor, account.currency)),
      fee: split.interestMinor
        ? toInputString(money(split.interestMinor, account.currency))
        : "",
      feeCategoryId: interestCategory,
    });
  };

  if (debts.length === 0) {
    return (
      <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
        <HandCoins aria-hidden className="mx-auto mb-2 size-5" />
        No loans. Add a loan, mortgage or line of credit on the Accounts screen,
        then give it its terms here.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {debts.map((account) => (
        <LoanCard
          key={account.id}
          account={account}
          loan={loanByAccount.get(account.id) ?? null}
          owedMinor={Math.max(
            0,
            -(balanceByAccount.get(account.id)?.balanceMinor ?? 0),
          )}
          today={today}
          onEdit={() => setEditing(account)}
          onPay={(loan) => recordPayment(account, loan)}
        />
      ))}
      {!interestCategory && (
        <p className="text-xs text-muted-foreground">
          Tip: add a category like &ldquo;Loan interest&rdquo; so the interest
          part of each payment shows up as spending.
        </p>
      )}
      <LoanSheet
        account={editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <TransactionSheet
        open={paying !== null}
        onOpenChange={(o) => !o && setPaying(null)}
        prefill={paying}
      />
    </div>
  );
}

function LoanCard({
  account,
  loan,
  owedMinor,
  today,
  onEdit,
  onPay,
}: {
  account: AccountRecord;
  loan: Loan | null;
  owedMinor: number;
  today: string;
  onEdit: () => void;
  onPay: (loan: Loan) => void;
}) {
  const currency = account.currency;
  const [lump, setLump] = useState("");
  const [lumpDate, setLumpDate] = useState(today);
  const [extra, setExtra] = useState("");
  const [renewRate, setRenewRate] = useState("");
  const [showSchedule, setShowSchedule] = useState(false);

  const read = (text: string) => {
    try {
      return text.trim() ? Math.max(0, parseAmount(text, currency).minor) : 0;
    } catch {
      return 0;
    }
  };

  const base = useMemo(
    () =>
      loan && owedMinor > 0 ? projectFromBalance(loan, owedMinor, today) : null,
    [loan, owedMinor, today],
  );
  const renewal = loan ? renewalDate(loan) : null;
  const whatIf = useMemo(() => {
    if (!loan || !base || owedMinor <= 0) return null;
    const lumpMinor = read(lump);
    const extraMinor = read(extra);
    const rate = renewRate.trim() ? Number(renewRate) : null;
    if (!lumpMinor && !extraMinor && (rate === null || !Number.isFinite(rate)))
      return null;
    return projectFromBalance(loan, owedMinor, today, {
      lumpSums:
        lumpMinor && isIsoDate(lumpDate)
          ? [{ date: lumpDate, amountMinor: lumpMinor }]
          : [],
      extraPerPaymentMinor: extraMinor,
      rateChange:
        rate !== null && Number.isFinite(rate) && renewal && renewal > today
          ? { date: renewal, annualRate: rate }
          : undefined,
    });
    // `read` is derived from these inputs.
  }, [loan, base, owedMinor, today, lump, lumpDate, extra, renewRate, renewal]);

  const yearly = useMemo(() => {
    if (!base) return [];
    const byYear = new Map<
      number,
      { interest: number; principal: number; end: number }
    >();
    for (const row of base.rows) {
      const y = yearOf(row.date);
      const entry = byYear.get(y) ?? { interest: 0, principal: 0, end: 0 };
      entry.interest += row.interestMinor;
      entry.principal += row.principalMinor + row.extraMinor;
      entry.end = row.balanceMinor;
      byYear.set(y, entry);
    }
    return [...byYear];
  }, [base]);

  return (
    <section
      className="rounded-surface border bg-card p-5"
      aria-labelledby={`loan-${account.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id={`loan-${account.id}`}
            className="font-heading text-base font-semibold"
          >
            {account.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            <Amount
              minor={owedMinor}
              currency={currency}
              className="font-semibold text-foreground"
            />{" "}
            owed
            {loan && (
              <>
                {" · "}
                {loan.annualRate}% {loan.rateType}, compounding{" "}
                {loan.compounding === "semiannual"
                  ? "semi-annually"
                  : loan.compounding}
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {loan && owedMinor > 0 && (
            <Button size="sm" onClick={() => onPay(loan)}>
              Record payment
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onEdit}>
            {loan ? "Edit terms" : "Add terms"}
          </Button>
        </div>
      </div>

      {!loan ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Add the rate and payment to see when it ends and what it costs.
        </p>
      ) : owedMinor <= 0 ? (
        <p className="mt-3 text-sm text-success">Paid off.</p>
      ) : base?.neverEnds ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          The payment does not cover the interest, so this balance never falls.
          Check the terms.
        </p>
      ) : base ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Payment</dt>
              <dd className="font-medium">
                <Amount minor={scheduledPayment(loan)} currency={currency} />{" "}
                <span className="text-xs text-muted-foreground">
                  {FREQUENCY_TEXT[loan.frequency].toLowerCase()}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Paid off</dt>
              <dd className="font-medium">{base.payoffDate}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Interest still to pay</dt>
              <dd className="font-medium">
                <Amount minor={base.totalInterestMinor} currency={currency} />
              </dd>
            </div>
            {renewal && (
              <div>
                <dt className="text-muted-foreground">Term renews</dt>
                <dd
                  className={cn(
                    "font-medium",
                    renewal > today &&
                      daysBetween(today, renewal) <= 120 &&
                      "text-warning",
                  )}
                >
                  {renewal}
                  {renewal > today && daysBetween(today, renewal) <= 120 && (
                    <span className="block text-xs">
                      in {daysBetween(today, renewal)} days — shop rates now
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
          {loan.prepaymentAllowancePct != null && (
            <p className="mt-2 text-xs text-muted-foreground">
              You can prepay up to{" "}
              <Amount
                minor={Math.floor(
                  (loan.principalMinor * loan.prepaymentAllowancePct) / 100,
                )}
                currency={currency}
              />{" "}
              a year without penalty ({loan.prepaymentAllowancePct}% of the
              original).
            </p>
          )}

          <fieldset className="mt-4 grid gap-3 rounded-control bg-secondary/40 p-3 sm:grid-cols-4">
            <legend className="sr-only">What if</legend>
            <div className="space-y-1">
              <Label htmlFor={`lump-${account.id}`} className="text-xs">
                Lump sum
              </Label>
              <Input
                id={`lump-${account.id}`}
                inputMode="decimal"
                value={lump}
                onChange={(e) => setLump(e.target.value)}
                placeholder="0.00"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`lumpdate-${account.id}`} className="text-xs">
                on
              </Label>
              <Input
                id={`lumpdate-${account.id}`}
                type="date"
                value={lumpDate}
                onChange={(e) => setLumpDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`extra-${account.id}`} className="text-xs">
                Extra each payment
              </Label>
              <Input
                id={`extra-${account.id}`}
                inputMode="decimal"
                value={extra}
                onChange={(e) => setExtra(e.target.value)}
                placeholder="0.00"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`renew-${account.id}`} className="text-xs">
                Rate at renewal %
              </Label>
              <Input
                id={`renew-${account.id}`}
                inputMode="decimal"
                value={renewRate}
                onChange={(e) => setRenewRate(e.target.value)}
                disabled={!renewal || renewal <= today}
                placeholder={renewal ? String(loan.annualRate) : "no term"}
                className="h-9"
              />
            </div>
            {whatIf && (
              <p className="text-sm sm:col-span-4" aria-live="polite">
                {whatIf.neverEnds ? (
                  <span className="text-destructive">
                    At that renewal rate the payment would no longer cover the
                    interest — the lender would raise it.
                  </span>
                ) : (
                  <>
                    Paid off <strong>{whatIf.payoffDate}</strong> instead of{" "}
                    {base.payoffDate};{" "}
                    {whatIf.totalInterestMinor <= base.totalInterestMinor ? (
                      <>
                        <Amount
                          minor={
                            base.totalInterestMinor - whatIf.totalInterestMinor
                          }
                          currency={currency}
                          className="font-semibold text-success"
                        />{" "}
                        less interest.
                      </>
                    ) : (
                      <>
                        <Amount
                          minor={
                            whatIf.totalInterestMinor - base.totalInterestMinor
                          }
                          currency={currency}
                          className="font-semibold text-destructive"
                        />{" "}
                        more interest.
                      </>
                    )}
                  </>
                )}
              </p>
            )}
          </fieldset>

          <Button
            variant="ghost"
            size="sm"
            className="mt-2 -ml-2"
            onClick={() => setShowSchedule((s) => !s)}
            aria-expanded={showSchedule}
          >
            {showSchedule ? "Hide" : "Show"} the schedule by year
          </Button>
          {showSchedule && (
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">Year</th>
                  <th className="py-1 text-right font-medium">Interest</th>
                  <th className="py-1 text-right font-medium">Principal</th>
                  <th className="py-1 text-right font-medium">
                    Owed at year end
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {yearly.map(([year, row]) => (
                  <tr key={year} className="border-t">
                    <td className="py-1">{year}</td>
                    <td className="py-1 text-right">
                      <Amount minor={row.interest} currency={currency} />
                    </td>
                    <td className="py-1 text-right">
                      <Amount minor={row.principal} currency={currency} />
                    </td>
                    <td className="py-1 text-right">
                      <Amount minor={row.end} currency={currency} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : null}
    </section>
  );
}
