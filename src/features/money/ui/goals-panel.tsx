"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/admin/shared";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/utils";
import { isIsoDate } from "../domain/dates";
import { type Goal, goalProgress, groupGoals } from "../domain/goals";
import { isLiability } from "../domain/ledger";
import { money, MoneyError, parseAmount, toInputString } from "../domain/money";
import {
  useDeleteGoalMutation,
  useSaveGoalMutation,
  useSetGoalFlagsMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { ALL_CURRENCIES } from "./labels";
import { useMoney } from "./money-context";

/**
 * Savings goals: each funded by the accounts set aside for it, so
 * progress is exactly what those accounts hold — and the pace is how they
 * actually grew, not how they were meant to.
 */
export function GoalsPanel() {
  const { goals, accounts, transactions, today, rateTable, accountById } =
    useMoney();
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const { active, achieved, archived } = groupGoals(goals);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          An emergency fund, a down payment, a trip home. Link the account the
          money sits in — a high-interest savings account, a TFSA, an FHSA — and
          progress keeps itself up to date.
        </p>
        <Button onClick={() => setEditing("new")}>
          <Plus className="mr-2 size-4" /> Goal
        </Button>
      </div>
      {active.length === 0 && achieved.length + archived.length > 0 ? (
        <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Target aria-hidden className="mx-auto mb-2 size-5" />
          No goals in progress.
        </p>
      ) : active.length === 0 ? (
        <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Target aria-hidden className="mx-auto mb-2 size-5" />
          No goals yet. An emergency fund of a few months&apos; essentials is
          the usual first one.
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {active.map((goal) => {
            const p = goalProgress(
              goal,
              accounts,
              transactions,
              today,
              rateTable,
            );
            const onPace =
              p.requiredPerMonthMinor === null ||
              p.pacePerMonthMinor >= p.requiredPerMonthMinor;
            return (
              <li key={goal.id}>
                <button
                  type="button"
                  onClick={() => setEditing(goal)}
                  className="block w-full rounded-surface border bg-card p-5 text-left transition-shadow hover:shadow-e2 focus-ring"
                >
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="font-heading text-base font-semibold">
                      {goal.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(p.ratio * 100)}%
                    </span>
                  </span>
                  <span
                    className="mt-3 block h-2 overflow-hidden rounded-full bg-secondary"
                    aria-hidden
                  >
                    <span
                      className={cn(
                        "block h-full",
                        p.ratio >= 1 ? "bg-success" : "bg-primary",
                      )}
                      style={{ width: `${p.ratio * 100}%` }}
                    />
                  </span>
                  <span className="mt-3 block text-sm">
                    <Amount
                      minor={p.savedMinor}
                      currency={goal.currency}
                      className="font-semibold"
                    />{" "}
                    of{" "}
                    <Amount minor={goal.targetMinor} currency={goal.currency} />
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {p.remainingMinor === 0 ? (
                      "Reached."
                    ) : p.requiredPerMonthMinor !== null ? (
                      <>
                        Needs{" "}
                        <Amount
                          minor={p.requiredPerMonthMinor}
                          currency={goal.currency}
                        />{" "}
                        a month to reach it by {goal.targetDate}.{" "}
                      </>
                    ) : null}
                    {p.remainingMinor > 0 &&
                      (p.pacePerMonthMinor > 0 ? (
                        <span className={cn(!onPace && "text-warning")}>
                          At the last 3 months&apos; pace (
                          <Amount
                            minor={p.pacePerMonthMinor}
                            currency={goal.currency}
                          />
                          /month) you get there around {p.projectedDate}.
                        </span>
                      ) : (
                        "The linked accounts have not grown in the last 3 months."
                      ))}
                  </span>
                  <span className="mt-2 block truncate text-xs text-muted-foreground">
                    {goal.accountIds
                      .map((id) => accountById.get(id)?.name)
                      .filter(Boolean)
                      .join(", ") || "No accounts linked yet"}
                    {p.unpricedAccounts > 0 &&
                      " · some balances have no exchange rate"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <GoalList
        heading="Achieved"
        goals={achieved}
        note={(g) => `Achieved ${g.achievedAt!.slice(0, 10)}`}
        onOpen={setEditing}
      />
      <GoalList
        heading="Archived"
        goals={archived}
        note={(g) => `Archived ${g.archivedAt!.slice(0, 10)}`}
        onOpen={setEditing}
      />
      <GoalSheet
        goal={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}

/** Goals that are no longer in progress: a row each, opening the same sheet. */
function GoalList({
  heading,
  goals,
  note,
  onOpen,
}: {
  heading: string;
  goals: Goal[];
  note: (goal: Goal) => string;
  onOpen: (goal: Goal) => void;
}) {
  if (goals.length === 0) return null;
  const id = `goals-${heading.toLowerCase()}`;
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-sm font-medium">
        {heading}
      </h3>
      <ul className="divide-y rounded-surface border bg-card text-sm">
        {goals.map((goal) => (
          <li key={goal.id}>
            <button
              type="button"
              onClick={() => onOpen(goal)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-secondary/40 focus-ring"
            >
              <span className="min-w-0 truncate font-medium">{goal.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                <Amount minor={goal.targetMinor} currency={goal.currency} /> ·{" "}
                {note(goal)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GoalSheet({
  goal,
  open,
  onOpenChange,
}: {
  goal: Goal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { openAccounts, goals, settings } = useMoney();
  const confirm = useConfirm();
  const [save, saving] = useSaveGoalMutation();
  const [remove] = useDeleteGoalMutation();
  const [setFlags] = useSetGoalFlagsMutation();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [currency, setCurrency] = useState(settings.baseCurrency);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [linked, setLinked] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? "");
    setTarget(
      goal ? toInputString(money(goal.targetMinor, goal.currency)) : "",
    );
    setCurrency(goal?.currency ?? settings.baseCurrency);
    setDate(goal?.targetDate ?? "");
    setNotes(goal?.notes ?? "");
    setLinked(goal?.accountIds ?? []);
    setProblem(null);
  }, [open, goal, settings.baseCurrency]);

  // An account funds one goal only; liabilities fund none.
  const takenElsewhere = new Set(
    goals.filter((g) => g.id !== goal?.id).flatMap((g) => g.accountIds),
  );
  const candidates = openAccounts.filter(
    (a) => !isLiability(a.kind) && !takenElsewhere.has(a.id),
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return setProblem("Name the goal.");
    let targetMinor: number;
    try {
      targetMinor = parseAmount(target, currency).minor;
      if (targetMinor <= 0) throw new MoneyError("has to be more than zero");
    } catch (error) {
      return setProblem(
        `Target: ${error instanceof Error ? error.message : "unreadable"}`,
      );
    }
    if (date && !isIsoDate(date)) return setProblem("Choose a valid date.");
    try {
      await save({
        id: goal?.id,
        name,
        targetMinor,
        currency,
        targetDate: date || null,
        notes: notes || null,
        accountIds: linked,
      }).unwrap();
      toast.success(goal ? "Goal updated" : "Goal added");
      onOpenChange(false);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  const destroy = async () => {
    if (!goal) return;
    const ok = await confirm({
      title: `Delete ${goal.name}?`,
      description: "The accounts and their money are untouched.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    await remove(goal.id);
    onOpenChange(false);
  };

  const flag = async (
    flags: { archived?: boolean; achieved?: boolean },
    done: string,
  ) => {
    if (!goal) return;
    try {
      await setFlags({ id: goal.id, ...flags }).unwrap();
      toast.success(done);
      onOpenChange(false);
    } catch (error) {
      setProblem(getErrorMessage(error));
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={goal ? `Edit ${goal.name}` : "New goal"}
      footer={
        <div className="flex gap-2">
          {goal && (
            <Button
              type="button"
              variant="outline"
              aria-label="Delete goal"
              onClick={destroy}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button
            type="submit"
            form="money-goal"
            className="flex-1"
            disabled={saving.isLoading}
          >
            {saving.isLoading && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Save
          </Button>
        </div>
      }
    >
      <form id="money-goal" onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="goal-name">Name</Label>
          <Input
            id="goal-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="e.g. Emergency fund"
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="goal-target">Target</Label>
            <Input
              id="goal-target"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-currency">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="goal-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-date">By (optional)</Label>
          <Input
            id="goal-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Money for it sits in</legend>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No free savings accounts — each account funds one goal.
            </p>
          ) : (
            candidates.map((account) => (
              <label
                key={account.id}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={linked.includes(account.id)}
                  onCheckedChange={(checked) =>
                    setLinked((list) =>
                      checked
                        ? [...list, account.id]
                        : list.filter((id) => id !== account.id),
                    )
                  }
                />
                {account.name}{" "}
                <span className="text-muted-foreground">
                  · {account.currency}
                </span>
              </label>
            ))
          )}
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="goal-notes">Notes</Label>
          <Textarea
            id="goal-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
          />
        </div>
        {goal && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            {!goal.archivedAt && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  flag(
                    { achieved: !goal.achievedAt },
                    goal.achievedAt
                      ? "Goal reopened"
                      : "Goal marked as achieved",
                  )
                }
              >
                {goal.achievedAt ? (
                  <RotateCcw className="mr-2 size-4" />
                ) : (
                  <Check className="mr-2 size-4" />
                )}
                {goal.achievedAt ? "Reopen" : "Mark as achieved"}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                flag(
                  { archived: !goal.archivedAt },
                  goal.archivedAt ? "Goal restored" : "Goal archived",
                )
              }
            >
              {goal.archivedAt ? (
                <ArchiveRestore className="mr-2 size-4" />
              ) : (
                <Archive className="mr-2 size-4" />
              )}
              {goal.archivedAt ? "Restore" : "Archive"}
            </Button>
          </div>
        )}
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </form>
    </FormSheet>
  );
}
