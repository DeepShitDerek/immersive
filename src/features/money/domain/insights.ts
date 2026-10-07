import type { IsoDate } from "./dates";
import { formatMoney, money } from "./money";
import { T1135_THRESHOLD_MINOR } from "./reports";

/**
 * The "understand my finance" layer: plain-language cards for the
 * overview, from facts the screens already compute. Rules, not predictions —
 * each card says what it saw and where to look.
 */

export type InsightTone = "alert" | "warn" | "good" | "info";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  /** Where to go to act on it. */
  area:
    | "overview"
    | "accounts"
    | "transactions"
    | "plan"
    | "investing"
    | "borrowing"
    | "reports"
    | "settings";
}

export interface InsightFacts {
  base: string;
  /** Last full month. */
  lastMonth: {
    label: string;
    incomeMinor: number;
    spendingMinor: number;
    savingsRate: number | null;
  } | null;
  /** Averages over the three full months before it. */
  priorAverage: { spendingMinor: number; savingsRate: number | null } | null;
  /** Spending per category: last full month against its prior three-month average. */
  categoryChanges: { name: string; lastMinor: number; averageMinor: number }[];
  liquidMinor: number;
  averageMonthlySpendingMinor: number;
  cardsOver30: { name: string; ratio: number }[];
  tfsaAvailableMinor: number | null;
  overBudget: { name: string; overMinor: number }[];
  dueThisWeek: { name: string; date: IsoDate }[];
  remittanceCostThisYearMinor: number;
  remittancesThisYear: number;
  /** Highest month-end cost of foreign property this year, in CAD. */
  foreignPropertyPeakMinor: number;
  renewals: { name: string; date: IsoDate; days: number }[];
  stalePrices: string[];
  forecastBelowZero: IsoDate | null;
}

const ORDER: Record<InsightTone, number> = {
  alert: 0,
  warn: 1,
  good: 2,
  info: 3,
};
const pct = (r: number) => `${Math.round(r * 100)}%`;
const list = (names: string[]) =>
  names.length <= 2
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

export function insights(f: InsightFacts): Insight[] {
  const out: Insight[] = [];
  const m = (minor: number, currency = f.base) =>
    formatMoney(money(minor, currency));

  if (f.forecastBelowZero) {
    out.push({
      id: "forecast-negative",
      tone: "alert",
      title: `Spendable money runs out around ${f.forecastBelowZero}`,
      detail:
        "Scheduled bills outrun what is in your everyday accounts before the next pay covers them. Move money, or push a bill.",
      area: "plan",
    });
  }

  if (f.averageMonthlySpendingMinor > 0) {
    const months = Math.max(0, f.liquidMinor) / f.averageMonthlySpendingMinor;
    const rounded =
      months >= 10 ? Math.round(months) : Math.round(months * 10) / 10;
    if (months < 1) {
      out.push({
        id: "runway",
        tone: "alert",
        title: `Less than a month of spending set aside`,
        detail: `${m(f.liquidMinor)} in easy-to-reach accounts against ${m(f.averageMonthlySpendingMinor)} a month. Living alone, three to six months is the usual cushion.`,
        area: "plan",
      });
    } else if (months < 3) {
      out.push({
        id: "runway",
        tone: "warn",
        title: `${rounded} months of spending set aside`,
        detail: `Three to six months is the usual cushion when you are on your own — a job gap or a move shouldn't mean borrowing.`,
        area: "plan",
      });
    } else {
      out.push({
        id: "runway",
        tone: "good",
        title: `${rounded} months of spending set aside`,
        detail:
          months >= 6
            ? "A solid cushion. Money beyond it can work harder in a TFSA or FHSA."
            : "A reasonable cushion; six months is stronger.",
        area: "plan",
      });
    }
  }

  if (f.lastMonth && f.lastMonth.savingsRate !== null) {
    const r = f.lastMonth.savingsRate;
    const prior = f.priorAverage?.savingsRate;
    const compare =
      prior != null ? ` (the three months before: ${pct(prior)})` : "";
    if (r < 0) {
      out.push({
        id: "savings",
        tone: "warn",
        title: `${f.lastMonth.label}: spent ${m(f.lastMonth.spendingMinor - f.lastMonth.incomeMinor)} more than came in`,
        detail:
          // Past −100% (more than twice what came in went out) a percentage says nothing a
          // reader can use: "kept −12648%". The two amounts do.
          r < -1
            ? `${m(f.lastMonth.spendingMinor)} went out against ${m(f.lastMonth.incomeMinor)} in${compare}.`
            : `Kept ${pct(r)} of income${compare}.`,
        area: "reports",
      });
    } else {
      out.push({
        id: "savings",
        tone: r >= 0.2 ? "good" : "info",
        title: `${f.lastMonth.label}: kept ${pct(r)} of what came in`,
        detail: `${m(f.lastMonth.incomeMinor - f.lastMonth.spendingMinor)} saved${compare}. 20% or more is a strong rate.`,
        area: "reports",
      });
    }
  }

  const jumps = f.categoryChanges
    .filter(
      (c) =>
        c.averageMinor > 0 &&
        c.lastMinor - c.averageMinor > Math.max(5_000, c.averageMinor * 0.25),
    )
    .sort(
      (a, b) => b.lastMinor - b.averageMinor - (a.lastMinor - a.averageMinor),
    );
  if (jumps.length > 0) {
    const j = jumps[0];
    out.push({
      id: "category-jump",
      tone: "info",
      title: `${j.name} up ${m(j.lastMinor - j.averageMinor)} last month`,
      detail: `${m(j.lastMinor)} against a usual ${m(j.averageMinor)}.`,
      area: "transactions",
    });
  }

  if (f.cardsOver30.length > 0) {
    out.push({
      id: "utilisation",
      tone: "warn",
      title: `${list(f.cardsOver30.map((c) => c.name))} over 30% of the limit`,
      detail:
        "High balances on the statement date weigh on a young Canadian credit file. Paying before the statement closes brings it down.",
      area: "borrowing",
    });
  }

  if (f.overBudget.length > 0) {
    out.push({
      id: "budget",
      tone: "warn",
      title: `Over budget: ${list(f.overBudget.map((b) => b.name))}`,
      detail: `${m(f.overBudget.reduce((t, b) => t + b.overMinor, 0))} over in all this month.`,
      area: "plan",
    });
  }

  if (f.foreignPropertyPeakMinor > T1135_THRESHOLD_MINOR) {
    out.push({
      id: "t1135",
      tone: "alert",
      title: "A T1135 is due with this year's return",
      detail: `Foreign property (accounts in India, foreign shares) reached ${m(f.foreignPropertyPeakMinor, "CAD")} at cost. Above $100,000 at any time, the CRA wants the form — the penalty for missing it is steep.`,
      area: "reports",
    });
  } else if (f.foreignPropertyPeakMinor > T1135_THRESHOLD_MINOR * 0.8) {
    out.push({
      id: "t1135",
      tone: "warn",
      title: "Foreign property is close to the T1135 line",
      detail: `${m(f.foreignPropertyPeakMinor, "CAD")} at cost this year; the form is needed above $100,000.`,
      area: "reports",
    });
  }

  for (const r of f.renewals) {
    out.push({
      id: `renewal-${r.name}`,
      tone: "warn",
      title: `${r.name} renews in ${r.days} days`,
      detail: `On ${r.date}. Lenders send a renewal offer late; compare rates now — switching at renewal costs no penalty.`,
      area: "borrowing",
    });
  }

  if (f.tfsaAvailableMinor !== null && f.tfsaAvailableMinor > 0) {
    out.push({
      id: "tfsa",
      tone: "info",
      title: `${m(f.tfsaAvailableMinor, "CAD")} of TFSA room unused`,
      detail:
        "Growth and withdrawals in a TFSA are tax-free in Canada. (India does not recognise it — worth knowing if you return.)",
      area: "investing",
    });
  }

  if (f.dueThisWeek.length > 0) {
    out.push({
      id: "due",
      tone: "info",
      title: `${f.dueThisWeek.length} bill${f.dueThisWeek.length === 1 ? "" : "s"} due in the next 7 days`,
      detail: list(
        f.dueThisWeek.slice(0, 4).map((d) => `${d.name} (${d.date})`),
      ),
      area: "plan",
    });
  }

  if (f.remittancesThisYear > 0 && f.remittanceCostThisYearMinor > 0) {
    out.push({
      id: "remittance",
      tone: "info",
      title: `Sending money cost ${m(f.remittanceCostThisYearMinor)} this year`,
      detail: `Fees and rate margins over ${f.remittancesThisYear} transfer${f.remittancesThisYear === 1 ? "" : "s"}. The Reports screen shows which provider cost least.`,
      area: "reports",
    });
  }

  if (f.stalePrices.length > 0) {
    out.push({
      id: "prices",
      tone: "info",
      title: `Prices over a month old: ${list(f.stalePrices.slice(0, 4))}`,
      detail: "Investment values use the latest price you entered.",
      area: "investing",
    });
  }

  return out.sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
}
