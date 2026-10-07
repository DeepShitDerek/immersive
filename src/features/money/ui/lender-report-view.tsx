"use client";

import { useMemo, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Application } from "../domain/applications";
import { type AssetGroup, lenderReport } from "../domain/lender-report";
import { GDS_LIMIT, RULES_AS_OF, TDS_LIMIT } from "../domain/qualify";
import { Amount } from "./amount";
import { PRODUCT_LABEL } from "./application-sheet";
import { EMPLOYMENT_LABEL } from "./income-panel";
import { countryLabel } from "./labels";
import { useMoney } from "./money-context";

const GROUP_LABEL: Record<AssetGroup, string> = {
  banking: "Bank accounts in Canada",
  registered: "Registered accounts (TFSA, RRSP, FHSA…)",
  investments: "Other investments",
  india: "Held in India",
  other: "Other assets",
};

const pct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
const tenure = (months: number) =>
  `${Math.floor(months / 12)}y ${months % 12}m`;

/**
 * The lender-ready summary: what a mortgage specialist or bank
 * officer asks for, filled in from the ledger. Printing isolates it on the
 * page (the admin chrome is hidden) so it can be saved as a PDF.
 */
export function LenderReportView({
  application,
}: {
  application: Application | null;
}) {
  const m = useMoney();
  const base = m.settings.baseCurrency;
  const report = useMemo(
    () =>
      lenderReport({
        today: m.today,
        base,
        residentSince: m.settings.residentSince,
        incomeSources: m.incomeSources,
        accounts: m.accounts,
        transactions: m.transactions,
        // Investments at market value, as a lender would count them.
        balanceByAccount: m.worthByAccount,
        loans: m.loanByAccount,
        rates: m.rateTable,
        scores: m.creditScores,
        applications: m.applications,
        application,
      }),
    [m, base, application],
  );
  const cur = (minor: number, className?: string) => (
    <Amount minor={minor} currency={base} className={className} />
  );
  const mortgage = report.mortgage;

  return (
    <div className="space-y-4">
      {/* Printing shows only the report. */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #money-lender-report, #money-lender-report * { visibility: visible !important; }
        #money-lender-report { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; }
      }`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          Built from your accounts today. Check it before you share it — and
          share it with the lender only, the way you would a bank statement.
        </p>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 size-4" /> Print or save as PDF
        </Button>
      </div>

      <article
        id="money-lender-report"
        aria-label="Lender report"
        className="space-y-6 rounded-surface border bg-card p-6 text-sm print:p-0"
      >
        <header>
          <h3 className="font-heading text-lg font-semibold">
            Financial summary
            {application
              ? ` — ${PRODUCT_LABEL[application.product]} with ${application.lender}`
              : ""}
          </h3>
          <p className="text-muted-foreground">
            As of {report.asOf} · amounts in {base}
            {report.monthsInCanada !== null &&
              ` · in Canada ${tenure(report.monthsInCanada)}`}
          </p>
        </header>

        <Section title="Income">
          {report.income.sources.length === 0 ? (
            <p className="text-muted-foreground">
              No income sources recorded — add them under Borrowing → Income.
            </p>
          ) : (
            <Table
              head={["Source", "Employment", "With them", "Gross / year"]}
              rows={report.income.sources.map((s) => [
                `${s.name}${s.role ? ` — ${s.role}` : ""}${s.country !== "CA" ? ` (${countryLabel(s.country)})` : ""}`,
                EMPLOYMENT_LABEL[s.employment],
                tenure(s.tenureMonths),
                s.grossAnnualBaseMinor === null
                  ? `${s.currency} — no rate`
                  : cur(s.grossAnnualBaseMinor),
              ])}
              foot={[
                "Total",
                "",
                "",
                cur(report.income.grossAnnualMinor, "font-semibold"),
              ]}
            />
          )}
          <p className="mt-2 text-muted-foreground">
            Gross monthly: {cur(report.income.grossMonthlyMinor)}
          </p>
        </Section>

        <Section
          title={`Cash flow, average of the last ${report.cashflow.months} month${report.cashflow.months === 1 ? "" : "s"}`}
        >
          {report.cashflow.months === 0 ? (
            <p className="text-muted-foreground">
              No full months of history yet.
            </p>
          ) : (
            <dl className="grid grid-cols-3 gap-3">
              <Stat label="Money in">
                {cur(report.cashflow.avgIncomeMinor)}
              </Stat>
              <Stat label="Spent">{cur(report.cashflow.avgSpendingMinor)}</Stat>
              <Stat label="Saved">{cur(report.cashflow.avgSavedMinor)}</Stat>
            </dl>
          )}
        </Section>

        <Section title="Assets">
          {(Object.keys(GROUP_LABEL) as AssetGroup[])
            .filter((g) => report.assets[g].length > 0)
            .map((g) => (
              <div key={g} className="mb-3">
                <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {GROUP_LABEL[g]}
                </h5>
                <Table
                  head={null}
                  rows={report.assets[g].map((l) => [
                    l.name,
                    l.detail,
                    cur(l.amountMinor),
                  ])}
                />
              </div>
            ))}
          <p className="font-semibold">
            Total assets: {cur(report.totals.assetsMinor)}
          </p>
        </Section>

        <Section title="Debts">
          {report.liabilities.length === 0 ? (
            <p className="text-muted-foreground">None.</p>
          ) : (
            <Table
              head={["Account", "Owed", "Limit", "Monthly payment"]}
              rows={report.liabilities.map((l) => [
                l.detail ? `${l.name} (${l.detail})` : l.name,
                cur(l.amountMinor),
                l.limitMinor ? cur(l.limitMinor) : "—",
                cur(l.monthlyPaymentMinor),
              ])}
              foot={[
                "Total",
                cur(report.totals.liabilitiesMinor),
                "",
                cur(report.totals.monthlyDebtPaymentsMinor),
              ]}
            />
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Card and line-of-credit payments are counted at 3% of the balance,
            as lenders do.
          </p>
          <p className="mt-2 font-semibold">
            Net worth: {cur(report.totals.netWorthMinor)}
          </p>
        </Section>

        <Section title="Credit">
          <p>
            {report.credit.latest.length === 0
              ? "No scores recorded."
              : report.credit.latest
                  .map(
                    (s) =>
                      `${s.bureau === "equifax" ? "Equifax" : s.bureau === "transunion" ? "TransUnion" : "Other"} ${s.score} (${s.asOf})`,
                  )
                  .join(" · ")}
          </p>
          <p className="text-muted-foreground">
            Hard inquiries in the last 12 months:{" "}
            {report.credit.inquiriesLastYear.length}
          </p>
        </Section>

        {mortgage && (
          <Section title="Mortgage qualification">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Price">{cur(mortgage.priceMinor)}</Stat>
              <Stat label="Down payment">
                {cur(mortgage.downPaymentMinor)}{" "}
                <span
                  className={cn(
                    "text-xs",
                    mortgage.downPaymentOk
                      ? "text-muted-foreground"
                      : "text-destructive",
                  )}
                >
                  (min {cur(mortgage.minimumDownMinor)})
                </span>
              </Stat>
              <Stat label="Mortgage">
                {cur(mortgage.mortgageMinor)}
                {mortgage.insuranceRate ? (
                  <span className="block text-xs text-muted-foreground">
                    incl. {(mortgage.insuranceRate * 100).toFixed(2)}% insurance
                  </span>
                ) : null}
              </Stat>
              <Stat label="Stress-test rate">
                {mortgage.qualifyingRate.toFixed(2)}%{" "}
                <span className="text-xs text-muted-foreground">
                  (contract {mortgage.contractRate}%)
                </span>
              </Stat>
              <Stat label="Payment at that rate">
                {cur(mortgage.qualifyingPaymentMinor)}/mo
              </Stat>
              {mortgage.ratios ? (
                <>
                  <Stat label={`GDS (limit ${GDS_LIMIT * 100}%)`}>
                    <span
                      className={
                        mortgage.ratios.passesGds
                          ? ""
                          : "font-semibold text-destructive"
                      }
                    >
                      {pct(mortgage.ratios.gds)}
                    </span>
                  </Stat>
                  <Stat label={`TDS (limit ${TDS_LIMIT * 100}%)`}>
                    <span
                      className={
                        mortgage.ratios.passesTds
                          ? ""
                          : "font-semibold text-destructive"
                      }
                    >
                      {pct(mortgage.ratios.tds)}
                    </span>
                  </Stat>
                </>
              ) : (
                <Stat label="Ratios">Need income</Stat>
              )}
              <Stat label="Largest mortgage the ratios allow">
                {cur(mortgage.maximumMortgageMinor)}
              </Stat>
            </dl>
            {!mortgage.downPaymentOk && (
              <p role="alert" className="mt-2 text-destructive">
                The down payment is below the minimum for this price.
              </p>
            )}
            {!mortgage.insurable && (
              <p className="mt-2 text-warning">
                Under 20% down on this price isn&apos;t insurable — a
                conventional (20% down) mortgage is needed.
              </p>
            )}
            {mortgage.downPaymentHistory.length > 0 && (
              <div className="mt-3">
                <h5 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Down-payment funds, 90 days ago and now
                </h5>
                <Table
                  head={null}
                  rows={mortgage.downPaymentHistory.map((h) => [
                    h.name,
                    cur(h.ninetyDaysAgoMinor),
                    cur(h.nowMinor),
                  ])}
                />
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Rules as of {RULES_AS_OF}. An estimate — the lender&apos;s own
              calculation decides.
            </p>
          </Section>
        )}

        {report.unconverted.length > 0 && (
          <p role="alert" className="text-warning">
            Left out for want of an exchange rate:{" "}
            {report.unconverted.join(", ")}. Add the rate under Settings.
          </p>
        )}
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h4 className="mb-2 border-b pb-1 font-heading text-base font-semibold">
        {title}
      </h4>
      {children}
    </section>
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

function Table({
  head,
  rows,
  foot,
}: {
  head: string[] | null;
  rows: ReactNode[][];
  foot?: ReactNode[];
}) {
  const align = (i: number, n: number) =>
    i === 0 ? "text-left" : i === n - 1 ? "text-right" : "text-left";
  return (
    <table className="w-full text-sm">
      {head && (
        <thead>
          <tr className="text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={cn("pb-1 font-medium", align(i, head.length))}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((row, r) => (
          <tr key={r} className="border-t">
            {row.map((cell, i) => (
              <td
                key={i}
                className={cn("py-1 tabular-nums", align(i, row.length))}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="border-t font-semibold">
            {foot.map((cell, i) => (
              <td
                key={i}
                className={cn("py-1 tabular-nums", align(i, foot.length))}
              >
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  );
}
