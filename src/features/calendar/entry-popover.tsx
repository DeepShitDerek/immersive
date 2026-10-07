"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { format, isSameDay } from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Pencil,
  Repeat,
  RotateCcw,
  Trash2,
  Video,
  X,
} from "lucide-react";
import type { Calendar, CalendarEntry } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { safeLinkUrl } from "@/lib/safe-url";
import { cn } from "@/lib/cn";
import { allDayRange, isAllDayLike } from "./layout";
import { describeRRule } from "./recurrence";
import { entryClasses } from "./entry-style";
import { OverlayDetailView } from "./overlay-detail-view";
import type { CreateRange } from "./time-grid";

/**
 * Something small and anchored to where you clicked: a popover beside the
 * event on a wide screen, a sheet from the bottom on a phone. Used for an
 * event's details and for naming a new one.
 */
function Anchored({
  anchor,
  compact,
  open,
  onClose,
  label,
  children,
}: {
  anchor: DOMRect | null;
  compact: boolean;
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  if (compact) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <SheetTitle className="sr-only">{label}</SheetTitle>
          {children}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={(next) => !next && onClose()}>
      <PopoverAnchor asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed"
          style={
            anchor
              ? {
                  left: anchor.left,
                  top: anchor.top,
                  width: anchor.width,
                  height: anchor.height,
                }
              : { left: 0, top: 0, width: 0, height: 0 }
          }
        />
      </PopoverAnchor>
      <PopoverContent
        side="right"
        align="start"
        collisionPadding={12}
        aria-label={label}
        className="w-80 p-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

/** "Monday 5 October, 09:00–10:30", or the dates of an all-day span. */
function whenLine(entry: CalendarEntry): string {
  if (isAllDayLike(entry)) {
    const { first, last } = allDayRange(entry);
    return isSameDay(first, last)
      ? `${format(first, "EEEE d MMMM")}, all day`
      : `${format(first, "EEE d MMM")} – ${format(last, "EEE d MMM")}, all day`;
  }
  if (isSameDay(entry.start, entry.end) || entry.end <= entry.start) {
    return `${format(entry.start, "EEEE d MMMM")}, ${format(entry.start, "HH:mm")}–${format(entry.end, "HH:mm")}`;
  }
  return `${format(entry.start, "EEE d MMM HH:mm")} – ${format(entry.end, "EEE d MMM HH:mm")}`;
}

export function EntryPopover({
  entry,
  anchor,
  compact,
  calendars,
  onClose,
  onEdit,
  onDelete,
  onReset,
}: {
  entry: CalendarEntry | null;
  anchor: DOMRect | null;
  compact: boolean;
  calendars: Calendar[];
  onClose: () => void;
  onEdit: (entry: CalendarEntry) => void;
  onDelete: (entry: CalendarEntry) => void;
  onReset: (entry: CalendarEntry) => void;
}) {
  const calendar = entry?.calendarId
    ? calendars.find((c) => c.id === entry.calendarId)
    : null;
  const meeting = safeLinkUrl(entry?.meetingUrl);
  const repeats = describeRRule(entry?.rrule);

  return (
    <Anchored
      anchor={anchor}
      compact={compact}
      open={entry !== null}
      onClose={onClose}
      label={entry?.title || "Event"}
    >
      {entry && (
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden
              className={cn(
                "mt-1.5 size-3 shrink-0 rounded-sm",
                entryClasses(entry.colorToken).dot,
              )}
            />
            <h2 className="min-w-0 flex-1 break-words text-base font-semibold leading-snug">
              {entry.title || "Untitled"}
            </h2>
            {entry.kind === "event" && (
              <div className="-mr-2 -mt-1 flex shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Edit"
                  title="Edit"
                  onClick={() => onEdit(entry)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 hover:text-destructive"
                  aria-label="Delete"
                  title="Delete"
                  onClick={() => onDelete(entry)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            )}
            {!compact && (
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 -mt-1 size-8 shrink-0"
                aria-label="Close"
                onClick={onClose}
              >
                <X className="size-4" aria-hidden />
              </Button>
            )}
          </div>

          {entry.kind === "event" ? (
            <dl className="space-y-1.5 text-sm">
              <Row icon={Clock} label="When">
                {whenLine(entry)}
                {entry.status === "tentative" && (
                  <span className="text-muted-foreground"> · tentative</span>
                )}
              </Row>
              {repeats && (
                <Row icon={Repeat} label="Repeats">
                  {repeats}
                  {entry.exceptionId && (
                    <span className="text-muted-foreground">
                      {" "}
                      · this one changed
                    </span>
                  )}
                </Row>
              )}
              {calendar && (
                <Row icon={CalendarIcon} label="Calendar">
                  {calendar.name}
                </Row>
              )}
              {entry.location && (
                <Row icon={MapPin} label="Where">
                  {entry.location}
                </Row>
              )}
              {entry.description && (
                <p className="line-clamp-4 whitespace-pre-wrap break-words pt-1 text-sm text-muted-foreground">
                  {entry.description}
                </p>
              )}
            </dl>
          ) : (
            <OverlayDetailView entry={entry} />
          )}

          {entry.kind === "event" && (meeting || entry.exceptionId) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {meeting && (
                <Button asChild size="sm">
                  <a href={meeting} target="_blank" rel="noopener noreferrer">
                    <Video className="mr-1.5 size-4" aria-hidden /> Join the
                    call
                  </a>
                </Button>
              )}
              {entry.exceptionId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onReset(entry)}
                >
                  <RotateCcw className="mr-1.5 size-4" aria-hidden /> Reset to
                  series
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Anchored>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <dt className="pt-0.5">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * Naming a new event where it was made: a title and Enter. "More options"
 * opens the full editor with the same times.
 */
export function QuickCreate({
  range,
  anchor,
  compact,
  onClose,
  onCreate,
  onMore,
}: {
  range: CreateRange | null;
  anchor: DOMRect | null;
  compact: boolean;
  onClose: () => void;
  onCreate: (title: string) => Promise<boolean>;
  onMore: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (range) {
      setTitle("");
      // After the popover has mounted and positioned.
      const id = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
  }, [range]);

  const submit = async () => {
    const name = title.trim();
    if (!name || busy) return;
    setBusy(true);
    const ok = await onCreate(name);
    setBusy(false);
    if (ok) onClose();
  };

  const when = range
    ? range.allDay
      ? `${format(range.start, "EEEE d MMMM")}, all day`
      : `${format(range.start, "EEEE d MMMM")}, ${format(range.start, "HH:mm")}–${format(range.end, "HH:mm")}`
    : "";

  return (
    <Anchored
      anchor={anchor}
      compact={compact}
      open={range !== null}
      onClose={onClose}
      label="New event"
    >
      {range && (
        <form
          className="space-y-3 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden /> {when}
          </p>
          <Input
            ref={inputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a title"
            aria-label="Event title"
            maxLength={200}
            className="h-10 text-base"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onMore(title.trim())}
            >
              More options
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim() || busy}>
              Save
            </Button>
          </div>
        </form>
      )}
    </Anchored>
  );
}
