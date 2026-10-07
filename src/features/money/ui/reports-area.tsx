"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import {
  addMonths,
  endOfMonth,
  makeDate,
  monthStart,
  yearOf,
} from "../domain/dates";
import { periodFlows } from "../domain/flows";
import {
  lastMonths,
  monthEnds,
  monthlySeries,
  netWorthHistory,
  remittances,
  T1135_THRESHOLD_MINOR,
  taxYear,
} from "../domain/reports";
import { Amount } from "./amount";
import { LineChart } from "./line-chart";
import { useMoney } from "./money-context";
import { useUrlTab } from "@/hooks/use-url-tab";

const pct = (r: number | null) =>
  r === null ? "—" : `${Math.round(r * 100)}%`;
const monthName = (key: string) =>
  new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-CA", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const TABS = ["months", "worth", "remittances", "tax"] as const;

/** Reports: months, net worth over time, the cost of sending money, and the tax year. */
export function ReportsArea() {
  // In the URL (?tab=), so Back and a reload return to it.
  const [tab, setTab] = useUrlTab("months", TABS);
  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-5">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList>
          <TabsTrigger value="months">Months</TabsTrigger>
          <TabsTrigger value="worth">Net worth</TabsTrigger>
          <TabsTrigger value="remittances">Sending money</TabsTrigger>
          <TabsTrigger value="tax">Tax year</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="months">
        <MonthsReport />
      </TabsContent>
      <TabsContent value="worth">
        <WorthReport />
      </TabsContent>
      <TabsContent value="remittances">
        <RemittanceReport />
      </TabsContent>
      <TabsContent value="tax">
        <TaxReport />
      </TabsContent>
    </Tabs>
  );
}

function MonthsReport() {
  const { transactions, categoryById, settings, today } = useMoney();
  const base = settings.baseCurrency;
  const months = useMemo(() => lastMonths(today, 12), [today]);
  const rows = useMemo(
    () => monthlySeries(transactions, months),
    [transactions, months],
  );
  const [selected, setSelected] = useState(months[months.length - 1]);
  const detail = useMemo(() => {
    const from = monthStart(selected);
    const f = periodFlows(transactions, from, endOfMonth(from));
    // Roll subcategories up to their parent.
    const byRoot = new Map<string, number>();
    for (const [id, minor] of f.spendingByCategory) {
      const c = id ? categoryById.get(id) : undefined;
      const root = c?.parentId ? categoryById.get(c.parentId) : c;
      const name = root?.name ?? "Uncategorised";
      byRoot.set(name, (byRoot.get(name) ?? 0) + minor);
    }
    return [...byRoot].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [selected, transactions, categoryById]);
  const shown = rows.filter((r) => r.incomeMinor || r.spendingMinor);
  const totals = shown.reduce(
    (t, r) => ({
      income: t.income + r.incomeMinor,
      spending: t.spending + r.spendingMinor,
    }),
    { income: 0, spending: 0 },
  );
  const maxCategory = detail[0]?.[1] ?? 0;

  if (shown.length === 0)
    return (
      <Empty>No income or spending recorded in the last twelve months.</Empty>
    );
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section
        aria-labelledby="months-heading"
        className="rounded-surface border bg-card p-5"
      >
        <h3
          id="months-heading"
          className="mb-2 font-heading text-base font-semibold"
        >
          The last twelve months
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1 font-medium">
                  Month
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  In
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Spent
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Kept
                </th>
                <th scope="col" className="py-1 text-right font-medium">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr
                  key={r.month}
                  className={cn(
                    "border-t",
                    r.month === selected && "bg-secondary/60",
                  )}
                >
                  <td className="py-1">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      aria-pressed={r.month === selected}
                      onClick={() => setSelected(r.month)}
                    >
                      {monthName(r.month)}
                    </button>
                  </td>
                  <td className="py-1 text-right">
                    <Amount minor={r.incomeMinor} currency={base} />
                  </td>
                  <td className="py-1 text-right">
                    <Amount minor={r.spendingMinor} currency={base} />
                  </td>
                  <td className="py-1 text-right">
                    <Amount minor={r.netMinor} currency={base} tone="balance" />
                  </td>
                  <td
                    className={cn(
                      "py-1 text-right",
                      r.savingsRate !== null &&
                        r.savingsRate < 0 &&
                        "text-destructive",
                    )}
                  >
                    {pct(r.savingsRate)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tabular-nums">
              <tr className="border-t font-semibold">
                <td className="py-1">Total</td>
                <td className="py-1 text-right">
                  <Amount minor={totals.income} currency={base} />
                </td>
                <td className="py-1 text-right">
                  <Amount minor={totals.spending} currency={base} />
                </td>
                <td className="py-1 text-right">
                  <Amount
                    minor={totals.income - totals.spending}
                    currency={base}
                    tone="balance"
                  />
                </td>
                <td className="py-1 text-right">
                  {pct(
                    totals.income
                      ? (totals.income - totals.spending) / totals.income
                      : null,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Moving money between your own accounts — including to India — is
          neither income nor spending. Transfer fees are spending.
        </p>
      </section>
      <section
        aria-labelledby="cat-heading"
        className="rounded-surface border bg-card p-5"
      >
        <h3
          id="cat-heading"
          className="mb-3 font-heading text-base font-semibold"
        >
          Where {monthName(selected)} went
        </h3>
        {detail.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No spending that month.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.map(([name, minor]) => (
              <li key={name}>
                <div className="flex justify-between gap-2">
                  <span className="truncate">{name}</span>
                  <Amount
                    minor={minor}
                    currency={base}
                    className="tabular-nums"
                  />
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"
                  aria-hidden
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(minor / maxCategory) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function WorthReport() {
  const {
    accounts,
    transactions,
    trades,
    securityById,
    priceBook,
    rateTable,
    settings,
    today,
  } = useMoney();
  const base = settings.baseCurrency;
  const points = useMemo(() => {
    const earliest = accounts.map((a) => a.openingDate).sort()[0];
    if (!earliest) return [];
    const yearAgo = addMonths(today, -12);
    const from = earliest > yearAgo ? earliest : yearAgo;
    return netWorthHistory({
      dates: monthEnds(from, today),
      base,
      accounts,
      transactions,
      trades,
      securities: securityById,
      prices: priceBook,
      rates: rateTable,
    });
  }, [
    accounts,
    transactions,
    trades,
    securityById,
    priceBook,
    rateTable,
    base,
    today,
  ]);

  if (points.length === 0)
    return <Empty>Add your accounts to see net worth over time.</Empty>;
  const first = points[0];
  const last = points[points.length - 1];
  return (
    <div className="space-y-5">
      <section
        aria-labelledby="worth-heading"
        className="rounded-surface border bg-card p-5"
      >
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3
            id="worth-heading"
            className="font-heading text-base font-semibold"
          >
            Net worth, month by month
          </h3>
          <p className="text-sm text-muted-foreground">
            <Amount
              minor={last.netMinor - first.netMinor}
              currency={base}
              tone="balance"
              className="font-semibold"
            />{" "}
            since {first.date}
          </p>
        </div>
        {points.length >= 2 ? (
          <LineChart
            points={points.map((p) => ({
              date: p.date,
              valueMinor: p.netMinor,
            }))}
            currency={base}
            label="Net worth by month"
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            A line needs a second month.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Each month at that day&apos;s exchange rates and investment prices —
          part of a change can be the rupee moving, not your saving.
        </p>
      </section>
      <section
        aria-label="Net worth table"
        className="overflow-x-auto rounded-surface border bg-card p-5"
      >
        <table className="w-full min-w-[26rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 font-medium">
                Date
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Own
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Owe
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Net worth
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {[...points].reverse().map((p) => (
              <tr key={p.date} className="border-t">
                <td className="py-1 text-muted-foreground">
                  {p.date}
                  {p.unpriced > 0 && <span className="text-warning"> *</span>}
                </td>
                <td className="py-1 text-right">
                  <Amount minor={p.assetsMinor} currency={base} />
                </td>
                <td className="py-1 text-right">
                  <Amount minor={-p.liabilitiesMinor} currency={base} />
                </td>
                <td className="py-1 text-right font-medium">
                  <Amount minor={p.netMinor} currency={base} tone="balance" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {points.some((p) => p.unpriced > 0) && (
          <p className="mt-2 text-xs text-warning">
            * Some accounts had no exchange rate that day and are left out.
          </p>
        )}
      </section>
    </div>
  );
}

function RemittanceReport() {
  const { transactions, accountById, rateTable, settings, today } = useMoney();
  const base = settings.baseCurrency;
  const years = yearsBack(today, 5);
  const [year, setYear] = useState(String(yearOf(today)));
  const r = useMemo(
    () =>
      remittances({
        transactions,
        accounts: accountById,
        from: makeDate(Number(year), 1, 1),
        to: makeDate(Number(year), 12, 31),
        base,
        rates: rateTable,
      }),
    [transactions, accountById, year, base, rateTable],
  );
  const byProvider = useMemo(() => {
    const map = new Map<
      string,
      { sent: number; cost: number; count: number }
    >();
    for (const item of r.items) {
      if (item.costBaseMinor === null || item.sentBaseMinor === null) continue;
      const key = item.provider?.trim() || "Not named";
      const row = map.get(key) ?? { sent: 0, cost: 0, count: 0 };
      row.sent += item.sentBaseMinor;
      row.cost += item.costBaseMinor;
      row.count += 1;
      map.set(key, row);
    }
    return [...map].sort(
      (a, b) => a[1].cost / a[1].sent - b[1].cost / b[1].sent,
    );
  }, [r.items]);

  return (
    <div className="space-y-5">
      <YearSelect id="rem-year" years={years} value={year} onChange={setYear} />
      {r.items.length === 0 ? (
        <Empty>
          No transfers between currencies in {year}. Record a transfer from a
          Canadian account to an Indian one, with what arrived, to see what it
          cost.
        </Empty>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 rounded-surface border bg-card p-5 text-sm sm:grid-cols-3">
            <Stat label="Sent">
              <Amount
                minor={r.sentBaseMinor}
                currency={base}
                className="text-lg font-semibold"
              />
            </Stat>
            <Stat label="Cost, fees and rate margin">
              <Amount
                minor={r.costBaseMinor}
                currency={base}
                className="text-lg font-semibold"
              />
            </Stat>
            <Stat label="Cost as a share">
              {r.sentBaseMinor
                ? `${((r.costBaseMinor / r.sentBaseMinor) * 100).toFixed(2)}%`
                : "—"}
            </Stat>
          </dl>
          {byProvider.length > 1 && (
            <section
              aria-labelledby="providers"
              className="rounded-surface border bg-card p-5 text-sm"
            >
              <h3
                id="providers"
                className="mb-2 font-heading text-base font-semibold"
              >
                By provider, cheapest first
              </h3>
              <ul className="divide-y">
                {byProvider.map(([name, v]) => (
                  <li key={name} className="flex justify-between gap-3 py-1.5">
                    <span>
                      {name}{" "}
                      <span className="text-xs text-muted-foreground">
                        · {v.count} transfer{v.count === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="tabular-nums">
                      {((v.cost / v.sent) * 100).toFixed(2)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section
            aria-label="Transfers"
            className="overflow-x-auto rounded-surface border bg-card p-5"
          >
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    Transfer
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Sent
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Arrived
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Rate got / market
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {r.items.map((i) => (
                  <tr key={i.transactionId} className="border-t align-top">
                    <td className="py-1.5 text-muted-foreground">{i.date}</td>
                    <td className="py-1.5">
                      {i.description}
                      {i.provider && (
                        <span className="block text-xs text-muted-foreground">
                          {i.provider}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      <Amount minor={i.sent.minor} currency={i.sent.currency} />
                      {i.fee.minor > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          +{" "}
                          <Amount
                            minor={i.fee.minor}
                            currency={i.fee.currency}
                          />{" "}
                          fee
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      <Amount
                        minor={i.received.minor}
                        currency={i.received.currency}
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      {i.cost ? i.cost.deliveredRate.toFixed(4) : "—"}
                      {i.marketRate && (
                        <span className="block text-xs text-muted-foreground">
                          {i.marketRate.toFixed(4)}
                          {i.rateSource === "stored" ? " (stored)" : ""}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      {i.cost ? (
                        <>
                          <Amount
                            minor={i.cost.totalCost.minor}
                            currency={i.cost.totalCost.currency}
                          />
                          <span className="block text-xs text-muted-foreground">
                            {(i.cost.costRatio * 100).toFixed(2)}%
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          no market rate
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              Cost is what the same money would have delivered at the mid-market
              rate, less what arrived, plus any fee. Enter the market rate on a
              transfer for the fairest comparison; otherwise that day&apos;s
              stored rate is used.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function TaxReport() {
  const {
    accounts,
    transactions,
    trades,
    categoryById,
    rateTable,
    settings,
    today,
  } = useMoney();
  const years = yearsBack(today, 5);
  const [year, setYear] = useState(
    String(yearOf(today) - (Number(today.slice(5, 7)) <= 4 ? 1 : 0)),
  );
  const t = useMemo(
    () =>
      taxYear({
        year: Number(year),
        accounts,
        transactions,
        trades,
        base: settings.baseCurrency,
        rates: rateTable,
      }),
    [year, accounts, transactions, trades, settings.baseCurrency, rateTable],
  );
  const income = [...t.incomeByCategory]
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1]);
  const c = (minor: number) => <Amount minor={minor} currency="CAD" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <YearSelect
          id="tax-year"
          years={years}
          value={year}
          onChange={setYear}
        />
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 size-4" /> Print
        </Button>
      </div>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #money-tax-year, #money-tax-year * { visibility: visible !important; }
        #money-tax-year { position: absolute; inset: 0 auto auto 0; width: 100%; }
      }`}</style>
      <article
        id="money-tax-year"
        aria-label={`Tax year ${year}`}
        className="space-y-5 rounded-surface border bg-card p-5 text-sm"
      >
        <header>
          <h3 className="font-heading text-lg font-semibold">
            {year} — figures for your return
          </h3>
          <p className="text-muted-foreground">
            In CAD. A checklist to match against your slips, not tax advice.
          </p>
        </header>

        <Block title="Income (outside TFSA, RRSP and FHSA)">
          {income.length === 0 ? (
            <p className="text-muted-foreground">No income recorded.</p>
          ) : (
            <dl className="space-y-1">
              {income.map(([id, v]) => (
                <Row
                  key={id ?? "none"}
                  label={
                    id
                      ? (categoryById.get(id)?.name ?? "Deleted category")
                      : "Uncategorised"
                  }
                >
                  {c(v)}
                </Row>
              ))}
              <Row label="Total" strong>
                {c(t.totalIncomeMinor)}
              </Row>
            </dl>
          )}
          {t.foreignIncomeMinor > 0 && (
            <p className="mt-2 text-warning">
              {c(t.foreignIncomeMinor)} arrived in accounts outside Canada (NRO
              interest, rent in India…). As a Canadian resident you report
              worldwide income; Indian tax already paid can usually be claimed
              as a foreign tax credit.
            </p>
          )}
        </Block>

        <Block title="Non-registered investments">
          <dl className="space-y-1">
            <Row label="Dividends and distributions (T5 / T3)">
              {c(t.dividendsMinor)}
            </Row>
            <Row label="Interest (T5)">{c(t.investmentInterestMinor)}</Row>
            <Row label="Capital gains, net (Schedule 3)">
              {c(t.realisedGainsMinor)}
            </Row>
            <Row label="Taxable half of gains">{c(t.taxableGainsMinor)}</Row>
          </dl>
          {t.realisedGainsMinor < 0 && (
            <p className="mt-2 text-muted-foreground">
              A net loss can offset gains of the three years before, or carry
              forward.
            </p>
          )}
        </Block>

        <Block title="Registered accounts">
          <dl className="space-y-1">
            <Row label="RRSP contributions (deductible)">
              {c(t.rrspContributedMinor)}
            </Row>
            <Row label="FHSA contributions (deductible)">
              {c(t.fhsaContributedMinor)}
            </Row>
            <Row label="TFSA contributions (not deductible)">
              {c(t.tfsaContributedMinor)}
            </Row>
          </dl>
          <p className="mt-2 text-muted-foreground">
            RRSP contributions made in the first 60 days of {Number(year) + 1}{" "}
            can also count for {year}.
          </p>
        </Block>

        <Block title="Foreign property (T1135)">
          <p>
            Highest cost at a month end:{" "}
            <strong>{c(t.foreignPropertyPeakMinor)}</strong>
            {t.foreignPropertyPeakDate && (
              <span className="text-muted-foreground">
                {" "}
                ({t.foreignPropertyPeakDate})
              </span>
            )}
            .
          </p>
          <p
            className={cn(
              "mt-1",
              t.t1135 === "not_required"
                ? "text-muted-foreground"
                : "font-semibold text-destructive",
            )}
          >
            {t.t1135 === "not_required"
              ? `Under the ${"$"}100,000 threshold — no T1135 needed, on these figures.`
              : t.t1135 === "simplified"
                ? "Over $100,000 at some point — file a T1135 (the simplified method applies below $250,000)."
                : "Over $250,000 — file a T1135 with the detailed, property-by-property method."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Counts accounts outside Canada at their balance and foreign-currency
            securities in non-registered accounts at cost. Personal-use property
            and registered accounts are excluded. The threshold is{" "}
            {`$${(T1135_THRESHOLD_MINOR / 100).toLocaleString("en-CA")}`}.
          </p>
        </Block>
        {t.unconverted > 0 && (
          <p role="alert" className="text-warning">
            {t.unconverted} amount(s) had no rate to CAD and are missing from
            these figures.
          </p>
        )}
      </article>
    </div>
  );
}

function yearsBack(today: string, count: number): string[] {
  const y = yearOf(today);
  return Array.from({ length: count }, (_, i) => String(y - i));
}

function YearSelect({
  id,
  years,
  value,
  onChange,
}: {
  id: string;
  years: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium">
        Year
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h4 className="mb-2 border-b pb-1 font-heading text-base font-semibold">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
  strong,
}: {
  label: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-3",
        strong && "border-t pt-1 font-semibold",
      )}
    >
      <dt className={cn(!strong && "text-muted-foreground")}>{label}</dt>
      <dd className="tabular-nums">{children}</dd>
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
