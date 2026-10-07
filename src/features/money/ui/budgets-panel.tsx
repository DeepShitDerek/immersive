"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/utils";
import {
  bucketSplit,
  budgetChange,
  budgetInForce,
  monthBudget,
  spendingByRoot,
} from "../domain/budget";
import { addMonths, monthKey, monthStart } from "../domain/dates";
import { money, MoneyError, parseAmount, toInputString } from "../domain/money";
import {
  useDeleteBudgetMutation,
  useSaveBudgetMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { useMoney } from "./money-context";

const monthName = (key: string) =>
  new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-15T00:00:00Z`));

/**
 * Monthly budgets and the 50/30/20 picture. A budget is set on a
 * top-level category and covers its subcategories; changing it applies from
 * the month shown onwards, never to the months before.
 */
export function BudgetsPanel() {
  const { transactions, categories, budgets, settings, today } = useMoney();
  const [month, setMonth] = useState(monthKey(today));
  const [save] = useSaveBudgetMutation();
  const [remove] = useDeleteBudgetMutation();

  const cache = useMemo(
    () => new Map<string, Map<string | null, number>>(),
    [transactions, categories],
  );
  const spendingFor = (m: string) => {
    if (!cache.has(m))
      cache.set(m, spendingByRoot(transactions, categories, m));
    return cache.get(m)!;
  };
  const lines = useMemo(
    () =>
      new Map(
        monthBudget(budgets, month, spendingFor).map((l) => [l.categoryId, l]),
      ),
    [budgets, month, cache],
  );
  const split = useMemo(
    () => bucketSplit(transactions, categories, month),
    [transactions, categories, month],
  );
  const spent = spendingFor(month);

  const roots = categories
    .filter((c) => !c.parentId && !c.archivedAt && c.bucket !== "income")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const base = settings.baseCurrency;
  const budgeted = [...lines.values()].reduce((t, l) => t + l.budgetMinor, 0);

  const setBudget = async (
    categoryId: string,
    text: string,
    rollover: boolean,
  ) => {
    let amount: number;
    try {
      amount = text.trim() ? parseAmount(text, base).minor : 0;
      if (amount < 0) throw new MoneyError("can't be negative");
    } catch (error) {
      toast.error(
        `Budget: ${error instanceof Error ? error.message : "unreadable"}`,
      );
      return;
    }
    const change = budgetChange(budgets, categoryId, month, amount, rollover);
    try {
      if (change.kind === "save") await save(change.budget).unwrap();
      if (change.kind === "delete") await remove(change.id).unwrap();
    } catch (error) {
      toast.error("Couldn't save the budget", {
        description: getErrorMessage(error),
      });
    }
  };

  const target = {
    need: settings.needsPct / 100,
    want: settings.wantsPct / 100,
    save: settings.savePct / 100,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous month"
          onClick={() => setMonth(monthKey(addMonths(monthStart(month), -1)))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <h2 className="font-heading text-lg font-semibold" aria-live="polite">
          {monthName(month)}
        </h2>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next month"
          onClick={() => setMonth(monthKey(addMonths(monthStart(month), 1)))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <section
        aria-labelledby="split-heading"
        className="rounded-surface border bg-card p-5"
      >
        <h3 id="split-heading" className="text-sm font-medium">
          Needs, wants and saving
        </h3>
        {split.shares ? (
          <>
            <div
              className="mt-3 flex h-3 overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label={`Needs ${Math.round(split.shares.need * 100)}%, wants ${Math.round(split.shares.want * 100)}%, saved ${Math.round(split.shares.save * 100)}%`}
            >
              <span
                className="bg-sky-600"
                style={{
                  width: `${Math.max(0, Math.min(100, split.shares.need * 100))}%`,
                }}
              />
              <span
                className="bg-warning"
                style={{
                  width: `${Math.max(0, Math.min(100, split.shares.want * 100))}%`,
                }}
              />
              <span
                className="bg-success"
                style={{
                  width: `${Math.max(0, Math.min(100, split.shares.save * 100))}%`,
                }}
              />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
              {(["need", "want", "save"] as const).map((bucket) => {
                const share = split.shares![bucket];
                const off =
                  bucket === "save"
                    ? share < target.save
                    : share > target[bucket];
                return (
                  <div key={bucket}>
                    <dt className="text-muted-foreground">
                      {bucket === "need"
                        ? "Needs"
                        : bucket === "want"
                          ? "Wants"
                          : "Saved"}
                    </dt>
                    <dd className={cn("font-semibold", off && "text-warning")}>
                      {Math.round(share * 100)}%{" "}
                      <span className="font-normal text-muted-foreground">
                        of {Math.round(target[bucket] * 100)}%
                      </span>
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      <Amount
                        minor={
                          bucket === "need"
                            ? split.needMinor
                            : bucket === "want"
                              ? split.wantMinor
                              : split.savedMinor
                        }
                        currency={base}
                      />
                    </dd>
                  </div>
                );
              })}
            </dl>
            {split.uncategorisedMinor > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Includes{" "}
                <Amount minor={split.uncategorisedMinor} currency={base} /> not
                yet categorised, counted as wants.
              </p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No income recorded this month, so there is nothing to split yet.
          </p>
        )}
      </section>

      <section aria-labelledby="budgets-heading" className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 id="budgets-heading" className="text-sm font-medium">
            Budgets ({base})
          </h3>
          {budgeted > 0 && (
            <span className="text-sm text-muted-foreground">
              <Amount minor={budgeted} currency={base} /> budgeted
            </span>
          )}
        </div>
        <ul className="divide-y rounded-surface border bg-card">
          {roots.map((category) => {
            const line = lines.get(category.id);
            const current = budgetInForce(budgets, category.id, month);
            const spentHere = spent.get(category.id) ?? 0;
            return (
              <BudgetRow
                key={`${category.id}-${month}-${current?.id ?? "none"}-${current?.amountMinor ?? 0}`}
                name={category.name}
                currency={base}
                budgetMinor={current?.amountMinor ?? null}
                rollover={current?.rollover ?? false}
                spentMinor={spentHere}
                line={line}
                onSave={(text, rollover) =>
                  setBudget(category.id, text, rollover)
                }
              />
            );
          })}
        </ul>
        {(spent.get(null) ?? 0) > 0 && (
          <p className="text-sm text-muted-foreground">
            Uncategorised this month:{" "}
            <Amount minor={spent.get(null)!} currency={base} />
          </p>
        )}
      </section>
    </div>
  );
}

function BudgetRow({
  name,
  currency,
  budgetMinor,
  rollover,
  spentMinor,
  line,
  onSave,
}: {
  name: string;
  currency: string;
  budgetMinor: number | null;
  rollover: boolean;
  spentMinor: number;
  line: ReturnType<typeof monthBudget>[number] | undefined;
  onSave: (text: string, rollover: boolean) => void;
}) {
  const [text, setText] = useState(
    budgetMinor ? toInputString(money(budgetMinor, currency)) : "",
  );
  const [roll, setRoll] = useState(rollover);
  const ratio = line
    ? Math.min(1, Number.isFinite(line.ratio) ? line.ratio : 1)
    : 0;
  const over = line && line.leftMinor < 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
      <div className="min-w-0">
        <span className="block truncate font-medium">{name}</span>
        <span className="block text-xs text-muted-foreground">
          <Amount minor={spentMinor} currency={currency} /> spent
          {line && (
            <>
              {" · "}
              <span className={cn(over && "font-semibold text-destructive")}>
                <Amount minor={Math.abs(line.leftMinor)} currency={currency} />{" "}
                {over ? "over" : "left"}
              </span>
              {line.carriedMinor !== 0 && (
                <>
                  {" "}
                  ·{" "}
                  <Amount
                    minor={line.carriedMinor}
                    currency={currency}
                    signed
                  />{" "}
                  carried
                </>
              )}
            </>
          )}
        </span>
      </div>
      <Input
        aria-label={`Budget for ${name}`}
        inputMode="decimal"
        value={text}
        placeholder="No budget"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onSave(text, roll)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-9 text-right"
      />
      <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground sm:col-span-1">
        <Switch
          checked={roll}
          onCheckedChange={(v) => {
            setRoll(v);
            if (text.trim()) onSave(text, v);
          }}
          aria-label={`Carry ${name}'s leftover into next month`}
        />
        Roll over
      </label>
      {line && (
        <div
          className="col-span-full h-1.5 overflow-hidden rounded-full bg-secondary"
          aria-hidden
        >
          <div
            className={cn(
              "h-full",
              over
                ? "bg-destructive"
                : ratio > 0.85
                  ? "bg-warning"
                  : "bg-success",
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
      )}
    </li>
  );
}
