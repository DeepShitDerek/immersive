"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addMinutes, format } from "date-fns";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Calendar, CalendarEntry } from "@/types";
import { eventSchema } from "@/lib/schemas";
import {
  useAddEventMutation,
  useSaveEventExceptionMutation,
  useUpdateEventMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSheet } from "@/components/admin/shared";
import { useChoice } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import { describeRRule } from "./recurrence";
import {
  calendarOptionsFor,
  frequencyOptionsFor,
  NONE,
} from "./select-options";
import { entryClasses } from "./entry-style";
import { allDayRange } from "./layout";
import { shiftSeries } from "./use-calendar-data";

export interface EditorDraft {
  start: Date;
  end: Date;
  allDay: boolean;
  title?: string;
}

const dateValue = (d: Date) => format(d, "yyyy-MM-dd");
const timeValue = (d: Date) => format(d, "HH:mm");
const combine = (date: string, time: string) =>
  new Date(`${date}T${time || "00:00"}`);

/**
 * Create and edit an event: every field, in a sheet.
 *
 * Kept from the old editor, because they are the rules that protect data:
 * one occurrence of a series asks whether a change is for "this one" (an
 * exception row) or the series; the payload is validated against the shared
 * schema before the write. Fixed on the way: saving the whole series from an
 * occurrence shifts the series' own start (it used to restart the series on
 * that occurrence's date), and an all-day event ends at the next midnight
 * (it ended where it started).
 */
export function EventEditor({
  entry,
  draft,
  calendars,
  defaultCalendarId,
  onClose,
  onDelete,
  onReset,
}: {
  entry: CalendarEntry | null;
  draft: EditorDraft | null;
  calendars: Calendar[];
  defaultCalendarId: string | null;
  onClose: () => void;
  onDelete: (entry: CalendarEntry) => void;
  onReset: (entry: CalendarEntry) => void;
}) {
  const [addEvent, { isLoading: adding }] = useAddEventMutation();
  const [updateEvent, { isLoading: updating }] = useUpdateEventMutation();
  const [saveException] = useSaveEventExceptionMutation();
  const choose = useChoice();

  const editing = entry?.kind === "event" ? entry : null;
  const open = editing !== null || draft !== null;

  const [title, setTitle] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [description, setDescription] = useState("");
  const [calendarId, setCalendarId] = useState(NONE);
  const [rrule, setRrule] = useState(NONE);

  useEffect(() => {
    if (!open) return;
    const source = editing
      ? {
          start: editing.start,
          end: editing.end,
          allDay: editing.isAllDay,
          title: editing.title,
        }
      : draft!;
    const start = source.start;
    const end =
      source.end > source.start ? source.end : addMinutes(source.start, 60);
    setTitle(source.title ?? "");
    setAllDay(source.allDay);
    setStartDate(dateValue(start));
    setStartTime(source.allDay ? "09:00" : timeValue(start));
    if (source.allDay) {
      // Shown inclusive: an event ending at the 8th's midnight ends "on the 7th".
      const { last } = allDayRange({
        ...(editing ?? {}),
        start,
        end,
        isAllDay: true,
        kind: "event",
      } as CalendarEntry);
      setEndDate(dateValue(last));
      setEndTime("10:00");
    } else {
      setEndDate(dateValue(end));
      setEndTime(timeValue(end));
    }
    setLocation(editing?.location ?? "");
    setMeetingUrl(editing?.meetingUrl ?? "");
    setDescription(editing?.description ?? "");
    setCalendarId(
      editing ? (editing.calendarId ?? NONE) : (defaultCalendarId ?? NONE),
    );
    setRrule(editing?.rrule || NONE);
  }, [open, editing, draft, defaultCalendarId]);

  const calendarOptions = useMemo(
    () => calendarOptionsFor(calendars, calendarId),
    [calendars, calendarId],
  );
  const frequencyOptions = useMemo(() => frequencyOptionsFor(rrule), [rrule]);

  const times = () => {
    if (allDay) {
      const start = combine(startDate, "00:00");
      const last = combine(endDate || startDate, "00:00");
      return { start, end: addDays(last < start ? start : last, 1) };
    }
    const start = combine(startDate, startTime);
    const end = combine(endDate || startDate, endTime || startTime);
    return { start, end };
  };

  const { start: s, end: e } = startDate ? times() : { start: null, end: null };
  const endBeforeStart = !!s && !!e && e < s;
  const valid = title.trim().length > 0 && !!startDate && !endBeforeStart;
  const busy = adding || updating;

  const payload = () => {
    const { start, end } = times();
    return {
      title: title.trim(),
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      is_all_day: allDay,
      location: location.trim() || null,
      meeting_url: meetingUrl.trim() || null,
      description: description.trim() || null,
      calendar_id: calendarId === NONE ? null : calendarId,
      rrule: rrule === NONE ? null : rrule,
    };
  };

  const save = async () => {
    if (!valid) return;
    const body = payload();
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      toast.error("Check the form", {
        description:
          parsed.error.errors[0]?.message ?? "Something here is not valid.",
      });
      return;
    }
    try {
      if (!editing) {
        await addEvent(body as never).unwrap();
        toast.success("Event added");
        onClose();
        return;
      }
      if (editing.rrule && editing.occurrenceStart) {
        const choice = await choose({
          title: "Change the whole series?",
          description:
            "This event repeats. Saving the series applies your changes to every occurrence; saving just this one leaves the rest alone.",
          confirmText: "Whole series",
          alternativeText: "Just this one",
        });
        if (!choice) return;
        const { start, end } = times();
        if (choice === "confirm") {
          const series = shiftSeries(editing, start, end);
          await updateEvent({
            id: editing.sourceId,
            ...body,
            start_time: series.start.toISOString(),
            end_time: series.end.toISOString(),
          } as never).unwrap();
          toast.success("Series updated");
        } else {
          await saveException({
            event_id: editing.sourceId,
            original_start: editing.occurrenceStart.toISOString(),
            is_cancelled: false,
            new_start: start.toISOString(),
            new_end: end.toISOString(),
            new_title: body.title,
          }).unwrap();
          toast.success("This occurrence updated");
        }
        onClose();
        return;
      }
      await updateEvent({ id: editing.sourceId, ...body } as never).unwrap();
      toast.success("Event updated");
      onClose();
    } catch (err) {
      toast.error("Couldn't save it", { description: getErrorMessage(err) });
    }
  };

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={editing ? "Edit event" : "New event"}
      description={
        editing?.rrule ? (describeRRule(editing.rrule) ?? undefined) : undefined
      }
      // Pinned under the form, so Save is never below the fold.
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {editing && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onDelete(editing)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-1.5 size-4" aria-hidden /> Delete
            </Button>
          )}
          {editing?.exceptionId && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onReset(editing)}
              className="text-muted-foreground"
            >
              <RotateCcw className="mr-1.5 size-4" aria-hidden /> Reset to
              series
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="event-editor-form"
              disabled={!valid || busy}
            >
              {busy && (
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
              )}
              {editing ? "Save" : "Add"}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="event-editor-form"
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a title"
            maxLength={200}
            className="h-11 text-base"
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="sr-only">When</legend>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="event-allday">All day</Label>
            <Switch
              id="event-allday"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="space-y-1">
              <Label
                htmlFor="event-start-date"
                className="text-xs text-muted-foreground"
              >
                Starts
              </Label>
              <Input
                id="event-start-date"
                type="date"
                value={startDate}
                onChange={(ev) => setStartDate(ev.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-1">
                <Label
                  htmlFor="event-start-time"
                  className="text-xs text-muted-foreground"
                >
                  Time
                </Label>
                <Input
                  id="event-start-time"
                  type="time"
                  step={900}
                  value={startTime}
                  onChange={(ev) => setStartTime(ev.target.value)}
                  className="w-32"
                />
              </div>
            )}
            <div className="space-y-1">
              <Label
                htmlFor="event-end-date"
                className="text-xs text-muted-foreground"
              >
                Ends
              </Label>
              <Input
                id="event-end-date"
                type="date"
                value={endDate}
                onChange={(ev) => setEndDate(ev.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-1">
                <Label
                  htmlFor="event-end-time"
                  className="text-xs text-muted-foreground"
                >
                  Time
                </Label>
                <Input
                  id="event-end-time"
                  type="time"
                  step={900}
                  value={endTime}
                  onChange={(ev) => setEndTime(ev.target.value)}
                  className="w-32"
                />
              </div>
            )}
          </div>
          {endBeforeStart && (
            <p role="alert" className="text-sm text-destructive">
              It ends before it starts.
            </p>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="event-repeat">Repeats</Label>
          <Select value={rrule} onValueChange={setRrule}>
            <SelectTrigger id="event-repeat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {frequencyOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rrule !== NONE && (
            <p className="text-xs text-muted-foreground">
              {describeRRule(rrule)}
            </p>
          )}
        </div>

        {calendars.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="event-calendar">Calendar</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger id="event-calendar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No calendar</SelectItem>
                {calendarOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "size-2.5 rounded-full",
                          entryClasses(c.color_token).dot,
                        )}
                      />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="event-location">Location</Label>
          <Input
            id="event-location"
            value={location}
            onChange={(ev) => setLocation(ev.target.value)}
            maxLength={300}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-url">Meeting link</Label>
          <Input
            id="event-url"
            type="url"
            inputMode="url"
            value={meetingUrl}
            onChange={(ev) => setMeetingUrl(ev.target.value)}
            placeholder="https://…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-notes">Notes</Label>
          <Textarea
            id="event-notes"
            rows={3}
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
          />
        </div>
      </form>
    </FormSheet>
  );
}
