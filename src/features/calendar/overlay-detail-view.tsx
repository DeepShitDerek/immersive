"use client";

import { format } from "date-fns";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { CalendarEntry } from "@/types";
import { useGetMoneySettingsQuery } from "@/features/money/data/money-api";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";
import { detailRows, habitsFrom, moneyFrom } from "./overlay-detail";

/**
 * The sheet for a task, a habit roll-up or a day's money.
 *
 * These are shown on the calendar but owned by their own modules, so nothing
 * here is editable — two places that can change the same row is how they drift
 * apart. Read-only was taken too literally at first, though: it showed the date
 * and nothing else, which is the one fact the grid had already given you. The
 * payload for all of this was already coming back from `get_calendar_data` and
 * simply being discarded.
 *
 * Every one of them ends in a link to the module that owns it, so "read-only"
 * is a routing decision rather than a dead end.
 */

const OWNER: Record<string, { href: string; label: string; note: string }> = {
  task: {
    href: "/admin/tasks",
    label: "Open in Tasks",
    note: "Shown here because it is due on this day.",
  },
  habit_summary: {
    href: "/admin/habits",
    label: "Open in Habits",
    note: "What you completed on this day.",
  },
  transaction_summary: {
    href: "/admin/finance",
    label: "Open in Finance",
    note: "What moved on this day.",
  },
};

export function OverlayDetailView({ entry }: { entry: CalendarEntry }) {
  const owner = OWNER[entry.kind];
  const rows = detailRows(entry);
  const habits = habitsFrom(entry);
  const money = moneyFrom(entry);

  // Only asked for when there is money to render — the calendar has no other
  // reason to load the money module's settings.
  const { data: moneySettings } = useGetMoneySettingsQuery(undefined, {
    skip: money === null,
  });
  const currency = moneySettings?.baseCurrency ?? "CAD";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">
          {format(entry.start, "EEEE d MMMM yyyy")}
        </p>
        {owner && <p className="text-sm text-muted-foreground">{owner.note}</p>}
      </div>

      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              {/* min-w-0 so a long value truncates rather than widening the
                  sheet, break-words so one unbroken token still wraps. */}
              <dd className="min-w-0 break-words font-medium text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {money && <MoneySummary money={money} currency={currency} />}

      {habits.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Habits
          </p>
          <ul className="space-y-1">
            {habits.map((habit, index) => (
              <li
                key={`${habit.title}-${index}`}
                className="flex items-center gap-2.5 text-sm"
              >
                {/*
                  A habit's colour is a hex value the habit owns, not a theme
                  token, so it cannot become a class — it goes through `style`.
                  Kept to a small dot for that reason: a full surface painted in
                  a stored hex would fight all 52 presets, a dot beside
                  token-coloured text does not.
                */}
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    !habit.color && "bg-muted-foreground/40",
                  )}
                  style={
                    habit.color ? { backgroundColor: habit.color } : undefined
                  }
                />
                <span className="min-w-0 break-words text-foreground">
                  {habit.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length === 0 && !money && habits.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing more was recorded against this day.
        </p>
      )}

      {owner && (
        <Link
          href={owner.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {owner.label}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function MoneySummary({
  money,
  currency,
}: {
  money: NonNullable<ReturnType<typeof moneyFrom>>;
  currency: string;
}) {
  return (
    <div className="space-y-3">
      {/*
        A forecast and a record must never read as the same thing. Said first,
        because every figure below it changes meaning.
      */}
      {money.expected && (
        <p className="rounded-surface bg-secondary/50 p-2.5 text-xs text-muted-foreground">
          Expected from your recurring rules — nothing has been recorded for
          this day yet.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Figure
          label={money.expected ? "Expected in" : "Earned"}
          value={formatMoney({ amount: money.earned, currency })}
          tone={money.earned > 0 ? "positive" : "neutral"}
        />
        <Figure
          label={money.expected ? "Expected out" : "Spent"}
          value={formatMoney({ amount: money.spent, currency })}
          tone={money.spent > 0 ? "negative" : "neutral"}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 rounded-surface bg-secondary/50 px-3 py-2">
        <span className="text-sm text-muted-foreground">Net</span>
        <span
          className={cn(
            "text-sm font-semibold tabular-nums",
            // success and warning are the status tokens;
            // literal palette classes would not move with the presets.
            money.net > 0 && "text-success",
            money.net < 0 && "text-warning",
          )}
        >
          {formatMoney({ amount: money.net, currency }, { signed: true })}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {money.expected
          ? money.count === 1
            ? "1 recurring rule falls on this day."
            : `${money.count} recurring rules fall on this day.`
          : money.count === 1
            ? "1 transaction, transfers excluded."
            : `${money.count} transactions, transfers excluded.`}
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="rounded-surface border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "positive" && "text-success",
          tone === "negative" && "text-warning",
          tone === "neutral" && "text-muted-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
