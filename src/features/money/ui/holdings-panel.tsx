"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LineChart, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { yearOf } from "../domain/dates";
import {
  accountFlows,
  allocation,
  type Portfolio,
  type Slice,
  xirr,
} from "../domain/invest";
import { convert, exponentOf, money } from "../domain/money";
import { Amount } from "./amount";
import { REGISTRATION_LABEL } from "./labels";
import { useMoney } from "./money-context";
import { ASSET_CLASS_LABEL, REGION_LABEL } from "./security-sheet";
import { TradeSheet } from "./trade-sheet";

const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

/**
 * What the investments are worth: each account's holdings at the
 * latest price, what they cost, the gain on paper and the gain taken, the
 * money-weighted return, and how it all divides up.
 */
export function HoldingsPanel() {
  const {
    accounts,
    portfolioByAccount,
    transactions,
    trades,
    settings,
    rateTable,
    today,
  } = useMoney();
  const base = settings.baseCurrency;
  const [recording, setRecording] = useState<string | null | undefined>(
    undefined,
  );
  const investment = accounts.filter(
    (a) =>
      a.kind === "investment" &&
      (!a.archivedAt ||
        (portfolioByAccount.get(a.id)?.holdings.length ?? 0) > 0),
  );
  const portfolios = investment
    .map((a) => portfolioByAccount.get(a.id))
    .filter((p): p is Portfolio => !!p);
  const alloc = useMemo(
    () => allocation(portfolios, base, today, rateTable),
    [portfolios, base, today, rateTable],
  );

  const year = yearOf(today);
  const toBase = (minor: number, currency: string): number | null => {
    if (currency === base) return minor;
    const q = rateTable.quote(currency, base, today);
    return q ? convert(money(minor, currency), q.rate, base).minor : null;
  };
  let unrealised = 0;
  let realisedThisYear = 0;
  let incomeThisYear = 0;
  for (const pf of portfolios) {
    for (const h of pf.holdings)
      unrealised += toBase(h.unrealisedMinor ?? 0, pf.currency) ?? 0;
    for (const d of pf.book.dispositions)
      if (yearOf(d.date) === year)
        realisedThisYear += toBase(d.gainMinor, pf.currency) ?? 0;
  }
  for (const t of trades) {
    if (
      yearOf(t.date) !== year ||
      t.date > today ||
      !["dividend", "interest", "reinvest"].includes(t.kind)
    )
      continue;
    const currency = accounts.find((a) => a.id === t.accountId)?.currency;
    if (currency) incomeThisYear += toBase(t.amountMinor, currency) ?? 0;
  }

  if (investment.length === 0) {
    return (
      <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
        <LineChart aria-hidden className="mx-auto mb-2 size-5" />
        No investment accounts yet. Add one on the Accounts screen (type:
        Investment) — one for each TFSA, RRSP, FHSA or brokerage account, and
        one per currency.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3 rounded-surface border bg-card p-5 text-sm sm:grid-cols-4">
        <Stat label="Invested, today">
          <Amount
            minor={alloc.total}
            currency={base}
            className="text-lg font-semibold"
          />
        </Stat>
        <Stat label="Gain on paper">
          <Amount minor={unrealised} currency={base} tone="balance" />
        </Stat>
        <Stat label={`Gains taken in ${year}`}>
          <Amount minor={realisedThisYear} currency={base} tone="balance" />
        </Stat>
        <Stat label={`Dividends & interest in ${year}`}>
          <Amount minor={incomeThisYear} currency={base} />
        </Stat>
      </dl>
      {alloc.unconverted.length > 0 && (
        <p className="text-xs text-warning">
          Left out of the totals for want of an exchange rate:{" "}
          {alloc.unconverted.join(", ")}.
        </p>
      )}

      {alloc.total > 0 && (
        <section
          aria-labelledby="alloc-heading"
          className="grid gap-4 md:grid-cols-3"
        >
          <h3 id="alloc-heading" className="sr-only">
            Allocation
          </h3>
          <Bars
            title="By asset class"
            slices={alloc.byClass}
            label={(k) => (k === "cash" ? "Cash" : ASSET_CLASS_LABEL[k])}
            base={base}
          />
          <Bars
            title="By region"
            slices={alloc.byRegion}
            label={(k) => REGION_LABEL[k]}
            base={base}
          />
          <Bars
            title="By currency"
            slices={alloc.byCurrency}
            label={(k) => k}
            base={base}
          />
        </section>
      )}

      {investment.map((account) => {
        const pf = portfolioByAccount.get(account.id);
        if (!pf) return null;
        const { flows, contributedMinor, withdrawnMinor } = accountFlows({
          accountId: account.id,
          openingDate: account.openingDate,
          openingBalanceMinor: account.openingBalanceMinor,
          transactions,
          valueMinor: pf.valueMinor,
          on: today,
        });
        const rate = xirr(flows);
        const firstFlow = flows[0]?.date;
        return (
          <section
            key={account.id}
            aria-labelledby={`pf-${account.id}`}
            className="rounded-surface border bg-card p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3
                  id={`pf-${account.id}`}
                  className="font-heading text-base font-semibold"
                >
                  {account.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {[
                    account.registration !== "none"
                      ? REGISTRATION_LABEL[account.registration]
                      : "Non-registered",
                    account.currency,
                  ].join(" · ")}
                </p>
              </div>
              <div className="text-right">
                <Amount
                  minor={pf.valueMinor}
                  currency={pf.currency}
                  className="text-lg font-semibold"
                />
                <p className="text-xs text-muted-foreground">
                  cash{" "}
                  <Amount
                    minor={pf.cashMinor}
                    currency={pf.currency}
                    tone="balance"
                  />
                </p>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat label="Put in">
                <Amount minor={contributedMinor} currency={pf.currency} />
              </Stat>
              <Stat label="Taken out">
                <Amount minor={withdrawnMinor} currency={pf.currency} />
              </Stat>
              <Stat label="Growth">
                <Amount
                  minor={pf.valueMinor - contributedMinor + withdrawnMinor}
                  currency={pf.currency}
                  tone="balance"
                />
              </Stat>
              <Stat label="Return a year">
                {rate === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span
                    className={cn(rate < 0 && "text-destructive")}
                    title={`Money-weighted since ${firstFlow}`}
                  >
                    {pct(rate)}
                  </span>
                )}
              </Stat>
            </dl>

            {pf.holdings.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-1 font-medium">
                        Holding
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Units
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Cost (ACB)
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Price
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Value
                      </th>
                      <th scope="col" className="py-1 text-right font-medium">
                        Gain
                      </th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {pf.holdings.map((h) => (
                      <tr key={h.securityId} className="border-t">
                        <td className="py-1.5">
                          <span className="font-medium">
                            {h.security.symbol}
                          </span>
                          <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">
                            {h.security.name}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">{h.units}</td>
                        <td className="py-1.5 text-right">
                          <Amount minor={h.acbMinor} currency={pf.currency} />
                          {h.units > 0 && (
                            <span className="block text-xs text-muted-foreground">
                              {(
                                h.acbMinor /
                                10 ** exponentOf(pf.currency) /
                                h.units
                              ).toFixed(4)}{" "}
                              each
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-right">
                          {h.price ? (
                            <>
                              {h.price.price}
                              <span
                                className={cn(
                                  "block text-xs",
                                  (h.priceAgeDays ?? 0) > 7
                                    ? "text-warning"
                                    : "text-muted-foreground",
                                )}
                              >
                                {h.price.date}
                              </span>
                            </>
                          ) : h.units > 0 ? (
                            <span className="text-xs text-warning">
                              no price
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              sold
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-right">
                          <Amount minor={h.valueMinor} currency={pf.currency} />
                        </td>
                        <td className="py-1.5 text-right">
                          {h.unrealisedMinor !== null && h.units > 0 && (
                            <>
                              <Amount
                                minor={h.unrealisedMinor}
                                currency={pf.currency}
                                tone="balance"
                              />
                              {h.acbMinor > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  {pct(h.unrealisedMinor / h.acbMinor)}
                                </span>
                              )}
                            </>
                          )}
                          {h.realisedMinor !== 0 && (
                            <span className="block text-xs text-muted-foreground">
                              taken{" "}
                              <Amount
                                minor={h.realisedMinor}
                                currency={pf.currency}
                              />
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pf.book.problems.length > 0 && (
              <ul
                role="alert"
                className="mt-3 space-y-1 text-sm text-destructive"
              >
                {pf.book.problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {pf.cashMinor < 0 && (
              <p className="mt-2 text-xs text-warning">
                Cash is below zero: record the deposit that paid for these
                trades (a transfer into this account), or check the amounts.
              </p>
            )}
            {pf.unpriced.length > 0 && (
              <p className="mt-2 text-xs text-warning">
                No price yet for {pf.unpriced.join(", ")} — counted at cost. Add
                one under Securities &amp; prices.
              </p>
            )}
            {account.registration === "none" &&
              pf.book.dispositions.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Gains here are taxable; half of a capital gain is added to
                  income. If you hold the same security in another
                  non-registered account, the CRA averages the cost across both.
                </p>
              )}
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => setRecording(account.id)}
            >
              <Plus className="mr-2 size-4" /> Record a trade
            </Button>
          </section>
        );
      })}
      <TradeSheet
        trade={null}
        open={recording !== undefined}
        onOpenChange={(o) => !o && setRecording(undefined)}
        defaultAccountId={recording}
      />
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

function Bars<K extends string>({
  title,
  slices,
  label,
  base,
}: {
  title: string;
  slices: Slice<K>[];
  label: (key: K) => string;
  base: string;
}) {
  return (
    <div className="rounded-surface border bg-card p-4">
      <h4 className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.key}>
            <div className="flex justify-between gap-2">
              <span className="truncate">{label(s.key)}</span>
              <span className="tabular-nums text-muted-foreground">
                {pct(s.share)}
              </span>
            </div>
            <div
              className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"
              aria-hidden
            >
              <div
                className="h-full bg-primary"
                style={{ width: `${s.share * 100}%` }}
              />
            </div>
            <span className="sr-only">
              <Amount minor={s.valueMinor} currency={base} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
