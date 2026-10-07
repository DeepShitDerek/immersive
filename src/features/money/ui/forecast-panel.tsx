"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";
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
import { addDays, monthStart } from "../domain/dates";
import { forecast, runwayMonths, type Scenario } from "../domain/forecast";
import { MoneyError, parseAmount } from "../domain/money";
import { lastMonths, monthlySeries } from "../domain/reports";
import { Amount } from "./amount";
import { LineChart } from "./line-chart";
import { useMoney } from "./money-context";

const STORE = "money-forecast-scenarios";

function loadScenarios(): Scenario[] {
  try {
    const raw = localStorage.getItem(STORE);
    const parsed = raw ? (JSON.parse(raw) as Scenario[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (s) =>
            typeof s.label === "string" && Number.isSafeInteger(s.monthlyMinor),
        )
      : [];
  } catch {
    return [];
  }
}

/**
 * The next weeks of spendable money: today's liquid balances,
 * every scheduled bill and paycheque, and what-ifs to try — a raise, a rent
 * change, a monthly amount sent to family.
 */
export function ForecastPanel() {
  const {
    accounts,
    balanceByAccount,
    schedules,
    transactions,
    skips,
    rateTable,
    settings,
    today,
  } = useMoney();
  const base = settings.baseCurrency;
  const [days, setDays] = useState("90");
  const [cushionText, setCushionText] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [day, setDay] = useState("1");
  const [problem, setProblem] = useState<string | null>(null);

  // What-ifs are a per-browser scratchpad, not records.
  useEffect(() => setScenarios(loadScenarios()), []);
  const keep = (next: Scenario[]) => {
    setScenarios(next);
    try {
      localStorage.setItem(STORE, JSON.stringify(next));
    } catch {
      // Storage blocked: they last for this visit.
    }
  };

  const cushion = (() => {
    try {
      return cushionText.trim()
        ? Math.max(0, parseAmount(cushionText, base).minor)
        : 0;
    } catch {
      return 0;
    }
  })();

  const result = useMemo(
    () =>
      forecast({
        today,
        days: Number(days),
        base,
        accounts,
        balanceByAccount,
        schedules,
        transactions,
        skips,
        rates: rateTable,
        scenarios,
        cushionMinor: cushion,
      }),
    [
      today,
      days,
      base,
      accounts,
      balanceByAccount,
      schedules,
      transactions,
      skips,
      rateTable,
      scenarios,
      cushion,
    ],
  );
  const plain = useMemo(
    () =>
      scenarios.length
        ? forecast({
            today,
            days: Number(days),
            base,
            accounts,
            balanceByAccount,
            schedules,
            transactions,
            skips,
            rates: rateTable,
          })
        : null,
    [
      scenarios.length,
      today,
      days,
      base,
      accounts,
      balanceByAccount,
      schedules,
      transactions,
      skips,
      rateTable,
    ],
  );

  // Average spending over the last three full months.
  const avgSpending = useMemo(() => {
    const months = lastMonths(addDays(monthStart(today.slice(0, 7)), -1), 3);
    const rows = monthlySeries(transactions, months).filter(
      (r) => r.incomeMinor || r.spendingMinor,
    );
    return rows.length
      ? Math.round(rows.reduce((t, r) => t + r.spendingMinor, 0) / rows.length)
      : 0;
  }, [transactions, today]);
  const runway = runwayMonths(result.startMinor, avgSpending);

  const add = (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    if (!label.trim())
      return setProblem("Name the what-if (e.g. Rent goes up, Send home).");
    let minor: number;
    try {
      minor = parseAmount(amount, base).minor;
    } catch (error) {
      return setProblem(
        error instanceof MoneyError ? error.message : "Unreadable amount.",
      );
    }
    if (minor <= 0) return setProblem("Enter a monthly amount above zero.");
    const d = Number(day);
    if (!Number.isInteger(d) || d < 1 || d > 31)
      return setProblem("The day is 1 to 31.");
    keep([
      ...scenarios,
      {
        id: `${Date.now()}`,
        label: label.trim().slice(0, 60),
        monthlyMinor: direction === "out" ? -minor : minor,
        day: d,
        fromMonth: null,
      },
    ]);
    setLabel("");
    setAmount("");
  };

  const liquidCount = accounts.filter(
    (a) => a.isLiquid && !a.archivedAt,
  ).length;
  if (liquidCount === 0) {
    return (
      <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
        Mark your everyday accounts as “easy to reach” (on each account) to see
        where they are heading.
      </p>
    );
  }

  let running = result.startMinor;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="fc-days" className="text-xs">
            Look ahead
          </Label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger id="fc-days" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">3 months</SelectItem>
              <SelectItem value="180">6 months</SelectItem>
              <SelectItem value="365">A year</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fc-cushion" className="text-xs">
            Warn below ({base})
          </Label>
          <Input
            id="fc-cushion"
            inputMode="decimal"
            value={cushionText}
            onChange={(e) => setCushionText(e.target.value)}
            placeholder="0.00"
            className="w-32"
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-surface border bg-card p-5 text-sm sm:grid-cols-4">
        <Stat label="Spendable today">
          <Amount
            minor={result.startMinor}
            currency={base}
            tone="balance"
            className="text-lg font-semibold"
          />
        </Stat>
        <Stat label={`Lowest (${result.lowest.date})`}>
          <Amount
            minor={result.lowest.balanceMinor}
            currency={base}
            tone="balance"
            className={cn(
              result.lowest.balanceMinor < cushion && "font-semibold",
            )}
          />
        </Stat>
        <Stat label={`On ${result.days[result.days.length - 1].date}`}>
          <Amount minor={result.endMinor} currency={base} tone="balance" />
          {plain && (
            <span className="block text-xs text-muted-foreground">
              without what-ifs <Amount minor={plain.endMinor} currency={base} />
            </span>
          )}
        </Stat>
        <Stat label="Lasts, at your spending">
          {runway === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            `${runway >= 10 ? Math.round(runway) : runway.toFixed(1)} months`
          )}
        </Stat>
      </dl>

      {result.firstBelowZero && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Below zero on {result.firstBelowZero}. Move money in, or push a bill
          back.
        </p>
      )}
      {!result.firstBelowZero && result.firstBelowCushion && (
        <p role="alert" className="text-sm text-warning">
          Below your cushion from {result.firstBelowCushion}.
        </p>
      )}

      <section
        aria-labelledby="fc-chart"
        className="rounded-surface border bg-card p-5"
      >
        <h3 id="fc-chart" className="mb-3 font-heading text-base font-semibold">
          Spendable money, day by day
        </h3>
        <LineChart
          points={result.days.map((d) => ({
            date: d.date,
            valueMinor: d.balanceMinor,
          }))}
          currency={base}
          label="Spendable money forecast"
          markers={[result.lowest.date]}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Scheduled bills, pay and transfers only — everyday spending without a
          schedule is not in the line.
          {result.overdue > 0 &&
            ` ${result.overdue} past-due occurrence${result.overdue === 1 ? " is" : "s are"} not counted; record or skip them under Bills & pay.`}
          {result.unpriced.length > 0 &&
            ` Left out for want of an exchange rate: ${result.unpriced.join(", ")}.`}
        </p>
      </section>

      <section
        aria-labelledby="fc-whatif"
        className="space-y-3 rounded-surface border bg-card p-5"
      >
        <h3 id="fc-whatif" className="font-heading text-base font-semibold">
          What if…
        </h3>
        <form
          onSubmit={add}
          className="flex flex-wrap items-end gap-3"
          noValidate
        >
          <div className="space-y-1">
            <Label htmlFor="wi-label" className="text-xs">
              What
            </Label>
            <Input
              id="wi-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Send home each month"
              className="w-52"
              maxLength={60}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wi-direction" className="text-xs">
              Money
            </Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as "in" | "out")}
            >
              <SelectTrigger id="wi-direction" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="out">Going out</SelectItem>
                <SelectItem value="in">Coming in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wi-amount" className="text-xs">
              A month ({base})
            </Label>
            <Input
              id="wi-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wi-day" className="text-xs">
              On day
            </Label>
            <Input
              id="wi-day"
              inputMode="numeric"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-16"
            />
          </div>
          <Button type="submit" variant="outline">
            Try it
          </Button>
        </form>
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        {scenarios.length > 0 && (
          <ul className="divide-y text-sm">
            {scenarios.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2">
                <span className="flex-1">
                  {s.label}{" "}
                  <span className="text-xs text-muted-foreground">
                    · day {s.day}
                  </span>
                </span>
                <Amount minor={s.monthlyMinor} currency={base} tone="balance" />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${s.label}`}
                  onClick={() => keep(scenarios.filter((x) => x.id !== s.id))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Kept in this browser only — nothing is saved to your records.
        </p>
      </section>

      {result.events.length > 0 && (
        <section
          aria-labelledby="fc-events"
          className="rounded-surface border bg-card"
        >
          <h3
            id="fc-events"
            className="px-5 pt-4 font-heading text-base font-semibold"
          >
            Coming up
          </h3>
          <div className="overflow-x-auto p-5 pt-2">
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="py-1 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-1 font-medium">
                    What
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Change
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Then
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {result.events.slice(0, 60).map((e, i) => {
                  running += e.amountMinor;
                  return (
                    <tr key={`${e.date}-${e.label}-${i}`} className="border-t">
                      <td className="py-1 text-muted-foreground">{e.date}</td>
                      <td className="py-1">
                        {e.label}
                        {e.source === "scenario" && (
                          <span className="text-xs text-muted-foreground">
                            {" "}
                            · what-if
                          </span>
                        )}
                      </td>
                      <td className="py-1 text-right">
                        <Amount
                          minor={e.amountMinor}
                          currency={base}
                          tone="balance"
                        />
                      </td>
                      <td
                        className={cn(
                          "py-1 text-right",
                          running < 0 && "text-destructive",
                        )}
                      >
                        <Amount minor={running} currency={base} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
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
