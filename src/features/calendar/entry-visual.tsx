"use client";

import { CheckSquare, Coins, Flame, MapPin, Repeat, Video } from "lucide-react";
import type { CalendarEntry } from "@/types";
import { cn } from "@/lib/cn";
import { entryClasses, isExpected } from "./entry-style";
import { timeLabel } from "./layout";

/**
 * How an entry looks, in each of the four places it is drawn. One component,
 * so an event reads the same in the week grid, the month and the agenda.
 *
 * Colour is the entry's calendar (or its overlay kind); it is never the only
 * cue: overlays carry an icon, a tentative event a dashed edge, a forecast a
 * dashed outline and the word "expected".
 */
const KIND_ICON = {
  task: CheckSquare,
  habit_summary: Flame,
  transaction_summary: Coins,
} as const;

export function KindIcon({
  entry,
  className,
}: {
  entry: CalendarEntry;
  className?: string;
}) {
  if (entry.kind === "event") return null;
  const Icon = KIND_ICON[entry.kind];
  return <Icon aria-hidden className={cn("size-3.5 shrink-0", className)} />;
}

export function entryAriaLabel(entry: CalendarEntry, day?: Date): string {
  const parts = [entry.title || "Untitled", timeLabel(entry, day)];
  if (entry.kind === "task") parts.push("task due");
  if (entry.kind === "habit_summary") parts.push("habits");
  if (entry.kind === "transaction_summary")
    parts.push(isExpected(entry) ? "money expected" : "money");
  if (entry.status === "tentative") parts.push("tentative");
  if (entry.rrule) parts.push("repeats");
  return parts.join(", ");
}

/** Surface classes for a filled entry. */
export function surfaceClasses(entry: CalendarEntry) {
  const c = entryClasses(entry.colorToken);
  return cn(
    "border-l-[3px] text-foreground",
    c.bg,
    c.border,
    entry.status === "tentative" && "border-dashed",
    isExpected(entry) && "border border-dashed bg-transparent",
  );
}

/** Time-grid block contents; the block itself is positioned by the grid. */
export function BlockContent({
  entry,
  heightPx,
  day,
}: {
  entry: CalendarEntry;
  heightPx: number;
  day: Date;
}) {
  const roomy = heightPx >= 40;
  return (
    <span className="flex h-full min-w-0 flex-col overflow-hidden px-1.5 py-1 text-left">
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-xs font-semibold leading-tight">
          {entry.title || "Untitled"}
        </span>
        {entry.rrule && (
          <Repeat aria-hidden className="size-3 shrink-0 opacity-70" />
        )}
      </span>
      {roomy && (
        <span className="truncate text-micro leading-tight text-muted-foreground">
          {timeLabel(entry, day)}
        </span>
      )}
      {roomy && heightPx >= 64 && (entry.location || entry.meetingUrl) && (
        <span className="mt-0.5 flex min-w-0 items-center gap-1 text-micro text-muted-foreground">
          {entry.meetingUrl ? (
            <Video aria-hidden className="size-3 shrink-0" />
          ) : (
            <MapPin aria-hidden className="size-3 shrink-0" />
          )}
          <span className="truncate">{entry.location || "Video call"}</span>
        </span>
      )}
    </span>
  );
}

/** One line: all-day bars, month chips. */
export function LineContent({
  entry,
  day,
  showTime = true,
}: {
  entry: CalendarEntry;
  day?: Date;
  showTime?: boolean;
}) {
  const timed = entry.kind === "event" && !entry.isAllDay;
  return (
    <span className="flex min-w-0 items-center gap-1 px-1.5 text-left">
      <KindIcon entry={entry} className="opacity-80" />
      {showTime && timed && (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {timeLabel(entry, day)
            .split("–")[0]
            .replace(/^(From|Until) /, "")}
        </span>
      )}
      <span className="truncate font-medium">{entry.title || "Untitled"}</span>
    </span>
  );
}

/** A small dot in the entry's colour: month cells on a phone, the mini month. */
export function EntryDot({ entry }: { entry: CalendarEntry }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        entryClasses(entry.colorToken).dot,
      )}
    />
  );
}
