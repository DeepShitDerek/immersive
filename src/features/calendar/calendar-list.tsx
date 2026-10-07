"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import type { Calendar, CalendarColorToken, CalendarSettings } from "@/types";
import {
  useDeleteCalendarMutation,
  useSaveCalendarMutation,
  useSaveCalendarSettingsMutation,
  useSeedCalendarDefaultsMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { calendarSchema, CALENDAR_LIMITS } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";

const TOKENS: CalendarColorToken[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

const SWATCH: Record<CalendarColorToken, string> = {
  "chart-1": "bg-chart-1",
  "chart-2": "bg-chart-2",
  "chart-3": "bg-chart-3",
  "chart-4": "bg-chart-4",
  "chart-5": "bg-chart-5",
};

/**
 * Which calendars are showing, and the overlays from other modules.
 *
 * Visibility is stored rather than kept in component state, so the view you
 * left is the view you come back to. Hiding "Work" at the weekend and having
 * it reappear on every reload is the sort of thing that makes a calendar feel
 * like it is arguing with you.
 */
export function CalendarList({
  calendars,
  settings,
}: {
  calendars: Calendar[];
  settings: CalendarSettings;
}) {
  const [saveCalendar] = useSaveCalendarMutation();
  const [deleteCalendar] = useDeleteCalendarMutation();
  const confirm = useConfirm();
  const [seedDefaults, { isLoading: isSeeding }] =
    useSeedCalendarDefaultsMutation();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const active = calendars.filter((entry) => !entry.archived_at);

  const toggle = async (calendar: Calendar) => {
    try {
      await saveCalendar({
        id: calendar.id,
        is_visible: !calendar.is_visible,
      }).unwrap();
    } catch (error) {
      toast.error("Could not update it", {
        description: getErrorMessage(error),
      });
    }
  };

  const remove = async (calendar: Calendar) => {
    const ok = await confirm({
      title: `Delete ${calendar.name}?`,
      description:
        "Events on it are kept — they lose the label and become uncategorised, so nothing disappears from the grid.",
      confirmText: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteCalendar(calendar.id).unwrap();
      toast.success("Calendar deleted");
    } catch (error) {
      toast.error("Could not delete it", {
        description: getErrorMessage(error),
      });
    }
  };

  const recolour = async (calendar: Calendar, token: CalendarColorToken) => {
    try {
      await saveCalendar({ id: calendar.id, color_token: token }).unwrap();
    } catch (error) {
      toast.error("Could not change the colour", {
        description: getErrorMessage(error),
      });
    }
  };

  const rename = async (calendar: Calendar, name: string) => {
    const trimmed = name.trim();
    setEditingId(null);
    if (!trimmed || trimmed === calendar.name) return;

    // The column bounds the name at 80 characters; without this the write
    // failed at Postgres with nothing to say which field was at fault.
    const checked = calendarSchema
      .pick({ name: true })
      .safeParse({ name: trimmed });
    if (!checked.success) {
      toast.error("Could not rename it", {
        description: checked.error.errors[0]?.message,
      });
      return;
    }

    try {
      await saveCalendar({ id: calendar.id, name: trimmed }).unwrap();
    } catch (error) {
      toast.error("Could not rename it", {
        description: getErrorMessage(error),
      });
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;

    const checked = calendarSchema.pick({ name: true }).safeParse({ name });
    if (!checked.success) {
      toast.error("Could not add it", {
        description: checked.error.errors[0]?.message,
      });
      return;
    }

    try {
      await saveCalendar({
        name,
        // Cycle through the tokens so a new calendar is not the same colour as
        // the last one by default.
        color_token: TOKENS[active.length % TOKENS.length],
        is_visible: true,
        sort_order: active.length * 10 + 100,
      }).unwrap();
      setNewName("");
    } catch (error) {
      toast.error("Could not add it", { description: getErrorMessage(error) });
    }
  };

  return (
    <section className="space-y-3" aria-label="Calendars">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Calendars</h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground"
              aria-label="Calendar settings"
            >
              <Settings2 className="size-3.5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto sm:max-w-md"
          >
            <SheetHeader>
              <SheetTitle>Calendar settings</SheetTitle>
            </SheetHeader>
            <CalendarSettingsForm
              settings={settings}
              onSeed={seedDefaults}
              isSeeding={isSeeding}
            />
          </SheetContent>
        </Sheet>
      </div>

      {active.length === 0 ? (
        <div className="rounded-surface border bg-card p-3">
          <p className="text-xs text-muted-foreground">
            No calendars yet. Four starters — Personal, Work, Family, Health —
            take a second to create.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-7 text-xs"
            disabled={isSeeding}
            onClick={() => void seedDefaults(null)}
          >
            Add starters
          </Button>
        </div>
      ) : (
        <ul className="space-y-0.5">
          {active.map((calendar) => (
            <li key={calendar.id}>
              {editingId === calendar.id ? (
                <CalendarRowEditor
                  calendar={calendar}
                  onRename={(name) => void rename(calendar, name)}
                  onRecolour={(token) => void recolour(calendar, token)}
                  onDelete={() => void remove(calendar)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void toggle(calendar)}
                    aria-pressed={calendar.is_visible}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-1.5 py-1.5 text-left transition-colors hover:bg-secondary/60"
                  >
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] transition-opacity",
                        SWATCH[calendar.color_token],
                        !calendar.is_visible && "opacity-25",
                      )}
                    >
                      {calendar.is_visible && (
                        <Check
                          className="size-2.5 text-background"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm",
                        calendar.is_visible
                          ? "text-foreground"
                          : "text-muted-foreground line-through",
                      )}
                    >
                      {calendar.name}
                    </span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(calendar.id)}
                    aria-label={`Edit ${calendar.name}`}
                    className="size-6 shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Pencil className="size-3" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-1.5">
        <Input
          maxLength={CALENDAR_LIMITS.NAME}
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void add();
          }}
          placeholder="New calendar"
          aria-label="New calendar name"
          className="h-7 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => void add()}
          disabled={!newName.trim()}
          aria-label="Add calendar"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/*
        The "Also show" toggles moved to the header as chips. They lived here,
        at the bottom of a panel hidden below 1280px, while two of the three
        ship off — so the overlays were unreachable on a laptop. One place owns
        them now; two would be two things to keep in step. See overlay-chips.tsx.
      */}
    </section>
  );
}

/**
 * Rename, recolour or delete, in place.
 *
 * A sheet to change one word and a colour would be three interactions and a
 * context switch for the only two edits a calendar ever gets.
 */
function CalendarRowEditor({
  calendar,
  onRename,
  onRecolour,
  onDelete,
  onCancel,
}: {
  calendar: Calendar;
  onRename: (name: string) => void;
  onRecolour: (token: CalendarColorToken) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(calendar.name);

  return (
    <div className="space-y-2 rounded-surface border bg-card p-2">
      <div className="flex items-center gap-1">
        <Input
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onRename(draft);
            if (event.key === "Escape") onCancel();
          }}
          aria-label={`Rename ${calendar.name}`}
          className="h-7 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => onRename(draft)}
          aria-label="Save name"
        >
          <Check className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <div
          role="radiogroup"
          aria-label="Colour"
          className="flex flex-1 gap-1.5"
        >
          {TOKENS.map((token) => (
            <button
              key={token}
              type="button"
              role="radio"
              aria-checked={calendar.color_token === token}
              aria-label={token}
              onClick={() => onRecolour(token)}
              className={cn(
                "size-5 rounded-[5px] transition-transform",
                SWATCH[token],
                calendar.color_token === token
                  ? "ring-2 ring-foreground ring-offset-1 ring-offset-card"
                  : "hover:scale-110",
              )}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
          aria-label={`Delete ${calendar.name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The settings that shape the grid.
 *
 * `home_timezone` is the important one: it is what puts a second hour column
 * beside the first, so a call at 8pm here can be read as a reasonable hour
 * there before it is scheduled.
 */
function CalendarSettingsForm({
  settings,
  onSeed,
  isSeeding,
}: {
  settings: CalendarSettings;
  onSeed: (tz: string | null) => void;
  isSeeding: boolean;
}) {
  const [saveSettings] = useSaveCalendarSettingsMutation();
  const [homeZone, setHomeZone] = useState(settings.home_timezone ?? "");

  // Every zone the runtime knows, so nobody has to remember the exact spelling
  // of "Asia/Kolkata". Falls back to a short list where unsupported.
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : ["Asia/Kolkata", "Europe/London", "America/New_York", "UTC"];

  const commit = async (value: string) => {
    try {
      await saveSettings({ home_timezone: value || null }).unwrap();
      toast.success(value ? `Home time set to ${value}` : "Home time hidden");
    } catch (error) {
      toast.error("Could not save", { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="mt-4 space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="home-zone">Home time zone</Label>
        <Input
          id="home-zone"
          list="calendar-zones"
          maxLength={CALENDAR_LIMITS.TIMEZONE}
          value={homeZone}
          onChange={(event) => setHomeZone(event.target.value)}
          onBlur={() => void commit(homeZone.trim())}
          placeholder="Asia/Kolkata"
        />
        <datalist id="calendar-zones">
          {zones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Adds a second hour column showing the time where your family is, so
          &ldquo;is 8pm here a reasonable hour to call&rdquo; is answerable
          without doing arithmetic. Leave blank to hide it.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="day-start">Day starts</Label>
          <Input
            id="day-start"
            type="number"
            min={0}
            max={23}
            defaultValue={settings.day_start_hour}
            onBlur={(event) =>
              void saveSettings({ day_start_hour: Number(event.target.value) })
            }
            className="tabular-nums"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="day-end">Day ends</Label>
          <Input
            id="day-end"
            type="number"
            min={1}
            max={24}
            defaultValue={settings.day_end_hour}
            onBlur={(event) =>
              void saveSettings({ day_end_hour: Number(event.target.value) })
            }
            className="tabular-nums"
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        The grid only draws these hours, so a day is not fifteen rows of nothing
        either side of the part you use.
      </p>

      <div className="rounded-surface border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Starter calendars</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Personal, Work, Family and Health, each with its own colour. Any
          existing events are filed under the default. Safe to run twice.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={isSeeding}
          onClick={() => onSeed(homeZone.trim() || null)}
        >
          Add starters
        </Button>
      </div>
    </div>
  );
}
