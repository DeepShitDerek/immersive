"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Loader2,
  MoreHorizontal,
  Plus,
  Repeat,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/utils";
import { categoryLabel } from "../domain/categories";
import { convert, money } from "../domain/money";
import { type EntryForm, formFromTransaction } from "../domain/entry";
import {
  type DueItem,
  draftFromOccurrence,
  dueQueue,
  monthlyEquivalent,
  nextOccurrence,
  type Schedule,
} from "../domain/schedule";
import {
  useRecordTransactionMutation,
  useSkipOccurrenceMutation,
} from "../data/money-api";
import { Amount } from "./amount";
import { shortDate } from "./labels";
import { useMoney } from "./money-context";
import { FREQUENCY_LABEL, ScheduleSheet } from "./schedule-sheet";
import { TransactionSheet } from "./transaction-sheet";

/**
 * What is due and what repeats. A schedule never writes to the
 * ledger by itself; the owner records each occurrence — in one click at the
 * scheduled amount, or through the form when the amount was different.
 */
export function UpcomingPanel({ compact = false }: { compact?: boolean }) {
  const data = useMoney();
  const {
    schedules,
    transactions,
    skips,
    today,
    accountById,
    settings,
    rateTable,
    categoryById,
  } = data;
  const [record] = useRecordTransactionMutation();
  const [skip] = useSkipOccurrenceMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Schedule | "new" | null>(null);
  const [recording, setRecording] = useState<{
    form: EntryForm;
    link: { scheduleId: string; occurrenceDate: string };
  } | null>(null);

  const queue = useMemo(
    () =>
      dueQueue(schedules, transactions, skips, today, {
        openingDate: (id) => accountById.get(id)?.openingDate,
      }),
    [schedules, transactions, skips, today, accountById],
  );

  const draftFor = (item: DueItem) =>
    draftFromOccurrence(
      item.schedule,
      item.dueDate,
      accountById,
      settings.baseCurrency,
      rateTable,
    );

  const recordNow = async (item: DueItem) => {
    const draft = draftFor(item);
    if (!draft) {
      toast.error("That schedule's accounts are missing — edit it first.");
      return;
    }
    setBusy(`${item.schedule.id}|${item.dueDate}`);
    try {
      await record({ ...draft, status: "cleared" }).unwrap();
      toast.success(`Recorded ${item.schedule.name}`);
    } catch (error) {
      toast.error(`Couldn't record ${item.schedule.name}`, {
        description: getErrorMessage(error),
      });
    } finally {
      setBusy(null);
    }
  };

  const recordAdjusted = (item: DueItem) => {
    const draft = draftFor(item);
    if (!draft) return;
    const form = formFromTransaction(
      {
        id: "draft",
        status: "cleared",
        notes: null,
        provider: null,
        marketRate: null,
        importHash: null,
        ...draft,
        payee: draft.payee,
      },
      accountById,
    );
    if (form)
      setRecording({
        form,
        link: { scheduleId: item.schedule.id, occurrenceDate: item.dueDate },
      });
  };

  const recordAllDue = async () => {
    const ready = queue.filter(
      (item) => item.status !== "upcoming" && !item.schedule.isEstimate,
    );
    setBusy("all");
    let done = 0;
    for (const item of ready) {
      const draft = draftFor(item);
      if (!draft) continue;
      try {
        await record(draft).unwrap();
        done += 1;
      } catch (error) {
        toast.error(`Stopped at ${item.schedule.name}`, {
          description: getErrorMessage(error),
        });
        break;
      }
    }
    setBusy(null);
    if (done)
      toast.success(`Recorded ${done} due item${done === 1 ? "" : "s"}`);
  };

  // The queue is date-ordered, so overdue and today come first anyway.
  const shown = compact ? queue.slice(0, 5) : queue;
  const dueNow = queue.filter(
    (q) => q.status !== "upcoming" && !q.schedule.isEstimate,
  ).length;
  const active = schedules.filter((s) => !s.archivedAt);

  // What repeats, per month, in the base currency where it can be priced.
  const monthly = useMemo(() => {
    const totals = { income: 0, expense: 0, transfer: 0 };
    for (const s of active) {
      const account = accountById.get(s.accountId);
      if (!account) continue;
      const quote = rateTable.quote(
        account.currency,
        settings.baseCurrency,
        today,
      );
      if (!quote) continue;
      totals[s.kind] += convert(
        money(monthlyEquivalent(s), account.currency),
        quote.rate,
        settings.baseCurrency,
      ).minor;
    }
    return totals;
  }, [active, accountById, rateTable, settings.baseCurrency, today]);

  return (
    <div className="space-y-6">
      {/* Compact (on Overview) the page supplies the heading and its link. */}
      <section
        aria-labelledby={compact ? undefined : "due-heading"}
        className="space-y-3"
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3",
            compact && "hidden",
          )}
        >
          <h2 id="due-heading" className="font-heading text-base font-semibold">
            {queue.length ? "Due" : "Nothing due"}
          </h2>
          {dueNow > 1 && !compact && (
            <Button
              variant="outline"
              size="sm"
              onClick={recordAllDue}
              disabled={busy !== null}
            >
              {busy === "all" && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Record all {dueNow} due
            </Button>
          )}
        </div>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {schedules.length
              ? "Everything scheduled for the last six weeks is recorded."
              : "Add what repeats — pay, rent, bills — and what is due shows up here."}
          </p>
        ) : (
          <ul className="divide-y rounded-surface border bg-card">
            {shown.map((item) => {
              const account = accountById.get(item.schedule.accountId);
              const key = `${item.schedule.id}|${item.dueDate}`;
              const signed =
                item.schedule.kind === "expense"
                  ? -item.schedule.amountMinor
                  : item.schedule.kind === "income"
                    ? item.schedule.amountMinor
                    : -item.schedule.amountMinor;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span
                    className={cn(
                      "w-24 shrink-0 text-xs tabular-nums",
                      item.status === "overdue"
                        ? "font-semibold text-destructive"
                        : item.status === "today"
                          ? "font-semibold text-primary"
                          : "text-muted-foreground",
                    )}
                  >
                    {item.status === "today"
                      ? "Today"
                      : shortDate(item.dueDate, today)}
                    {item.status === "overdue" && (
                      <span className="block font-normal">overdue</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.schedule.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {account?.name ?? "Missing account"}
                      {item.schedule.kind === "transfer" &&
                      item.schedule.toAccountId
                        ? ` → ${accountById.get(item.schedule.toAccountId)?.name ?? "?"}`
                        : ` · ${categoryLabel(item.schedule.categoryId, categoryById)}`}
                      {item.schedule.isEstimate && " · estimate"}
                    </span>
                  </span>
                  {account && (
                    <Amount
                      minor={signed}
                      currency={account.currency}
                      tone="flow"
                      signed
                      className="font-semibold"
                    />
                  )}
                  {/* One action per row: record it (or, for an estimate, enter
                      the real amount). Adjusting first and skipping this one
                      are rarer, so they wait under ⋯ instead of wrapping the
                      row onto a second line on a phone. */}
                  <span className="flex items-center gap-1">
                    {item.schedule.isEstimate ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recordAdjusted(item)}
                      >
                        Enter amount
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => recordNow(item)}
                        disabled={busy !== null}
                        aria-label={`Record ${item.schedule.name} due ${item.dueDate}`}
                      >
                        {busy === key ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          "Record"
                        )}
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          aria-label={`More actions: ${item.schedule.name} due ${item.dueDate}`}
                        >
                          <MoreHorizontal aria-hidden className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!item.schedule.isEstimate && (
                          <DropdownMenuItem
                            onSelect={() => recordAdjusted(item)}
                          >
                            Adjust and record
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() =>
                            skip({
                              scheduleId: item.schedule.id,
                              dueDate: item.dueDate,
                              skip: true,
                            })
                          }
                        >
                          Skip this one
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!compact && (
        <section aria-labelledby="repeats-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="repeats-heading"
              className="font-heading text-base font-semibold"
            >
              What repeats
            </h2>
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-2 size-4" /> Schedule
            </Button>
          </div>
          {active.length > 0 && (
            <p className="text-sm text-muted-foreground">
              A month of it:{" "}
              <Amount minor={monthly.income} currency={settings.baseCurrency} />{" "}
              in,{" "}
              <Amount
                minor={monthly.expense}
                currency={settings.baseCurrency}
              />{" "}
              in bills and{" "}
              <Amount
                minor={monthly.transfer}
                currency={settings.baseCurrency}
              />{" "}
              moved between accounts.
            </p>
          )}
          {schedules.length === 0 ? (
            <p className="rounded-surface border border-dashed p-8 text-center text-sm text-muted-foreground">
              <Repeat aria-hidden className="mx-auto mb-2 size-5" />
              Nothing yet. Start with your paycheque and rent.
            </p>
          ) : (
            <ul className="divide-y rounded-surface border bg-card text-sm">
              {schedules.map((s) => {
                const account = accountById.get(s.accountId);
                const next = nextOccurrence(s, today);
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5",
                      s.archivedAt && "opacity-60",
                    )}
                  >
                    <CalendarClock
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left hover:underline"
                      onClick={() => setEditing(s)}
                    >
                      <span className="block truncate font-medium">
                        {s.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {FREQUENCY_LABEL[s.frequency]}
                        {s.archivedAt
                          ? " · paused"
                          : next
                            ? ` · next ${next}`
                            : " · finished"}
                      </span>
                    </button>
                    {account && (
                      <Amount
                        minor={
                          s.kind === "income" ? s.amountMinor : -s.amountMinor
                        }
                        currency={account.currency}
                        tone="flow"
                        signed
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <ScheduleSheet
        schedule={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <TransactionSheet
        open={recording !== null}
        onOpenChange={(o) => !o && setRecording(null)}
        prefill={recording?.form ?? null}
        link={recording?.link ?? null}
      />
    </div>
  );
}
