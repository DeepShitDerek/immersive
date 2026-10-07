"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, format, isSameMonth, startOfDay } from "date-fns";
import { ChevronLeft, ChevronRight, PanelRight, Plus } from "lucide-react";
import type { CalendarEntry } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState, ManagerWrapper } from "@/components/admin/shared";
import { useRememberedChoice } from "@/hooks/use-remembered-choice";
import { useBelowBreakpoint } from "@/hooks/use-media-query";
import { isTypingTarget } from "@/features/maps/state/keyboard";
import { shortcutsOwnedByEditor } from "@/lib/editor-shortcuts";
import { cn } from "@/lib/cn";
import { useCalendarData } from "./use-calendar-data";
import { useEventActions } from "./use-event-actions";
import { stepDays, viewWindow, type CalendarView } from "./view-window";
import {
  DENSITY_OPTIONS,
  HOUR_HEIGHT,
  useDensity,
  type Density,
} from "./density";
import { entriesByDay } from "./layout";
import { TimeGrid, type CreateRange } from "./time-grid";
import { MonthGrid } from "./month-grid";
import { AgendaList } from "./agenda-list";
import { EntryPopover, QuickCreate } from "./entry-popover";
import { EventEditor, type EditorDraft } from "./event-editor";
import { MiniMonth } from "./mini-month";
import { OverlaysMenu } from "./overlay-chips";
import { GridStatus } from "./grid-status";
import { QuickAddBar } from "./quick-add-bar";
import { TaskRail } from "./task-rail";
import { CalendarList } from "./calendar-list";
import { FreeTimeBar } from "./free-time-bar";

const VIEWS: {
  id: CalendarView;
  label: string;
  key: string;
  phone: boolean;
}[] = [
  { id: "day", label: "Day", key: "d", phone: true },
  { id: "3day", label: "3 days", key: "3", phone: true },
  { id: "week", label: "Week", key: "w", phone: false },
  { id: "month", label: "Month", key: "m", phone: true },
  { id: "agenda", label: "Agenda", key: "a", phone: true },
];
const VIEW_IDS = VIEWS.map((v) => v.id);

type Editing = { entry: CalendarEntry } | { draft: EditorDraft } | null;

/**
 * The calendar, rebuilt.
 *
 * The grid is the module's own again, not FullCalendar's: one set of views
 * drawn from `layout.ts`, styled with the theme like everything else, and
 * built for a phone as well as a desk.
 *
 * - Day, 3 days, week, month and agenda. On a phone "week" is three days,
 *   and the month shows dots with the chosen day listed underneath.
 * - Click an event for its details beside it (a sheet on a phone); double-
 *   click, or Edit, for every field.
 * - Click or drag on empty time to make an event and name it in place.
 * - Drag an event to move it, its bottom edge to change its length, a task
 *   from the panel to give it time.
 * - The panel: a month to jump around, quick add, unscheduled tasks,
 *   calendars, free time and hour size. From lg, hideable; below, a sheet.
 */
export default function CalendarPage() {
  const narrow = useBelowBreakpoint("md");
  const belowLg = useBelowBreakpoint("lg");

  const [chosenView, setChosenView] = useRememberedChoice<CalendarView>(
    "calendar",
    "week",
    VIEW_IDS,
  );
  // A phone has no room for seven days; "week" there is three.
  const view: CalendarView =
    narrow && chosenView === "week" ? "3day" : chosenView;
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [density, setDensity] = useDensity();
  const [panelChoice, setPanelChoice] = useRememberedChoice<"open" | "closed">(
    "calendar-panel",
    "open",
    ["open", "closed"],
  );
  const panelOpen = panelChoice === "open";
  const [panelSheet, setPanelSheet] = useState(false);

  const [selected, setSelected] = useState<{
    entry: CalendarEntry;
    anchor: DOMRect;
  } | null>(null);
  const [creating, setCreating] = useState<{
    range: CreateRange;
    anchor: DOMRect;
  } | null>(null);
  const [editing, setEditing] = useState<Editing>(null);

  // Settings arrive with the data; the window needs the week start first.
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(
    1,
  );
  const { days, from, to } = useMemo(
    () => viewWindow({ view, anchor, weekStartsOn }),
    [view, anchor, weekStartsOn],
  );
  const data = useCalendarData({ from, to });
  const { settings } = data;
  useEffect(() => {
    if (settings)
      setWeekStartsOn(
        (settings.week_starts_on ?? 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      );
  }, [settings]);

  const actions = useEventActions();
  const entries = useMemo(
    () =>
      actions.pendingDeletes.size
        ? data.entries.filter((e) => !actions.pendingDeletes.has(e.sourceId))
        : data.entries,
    [data.entries, actions.pendingDeletes],
  );
  const busyDays = useMemo(() => {
    const keys = new Set<string>();
    for (const [key, list] of entriesByDay(
      entries,
      days.length ? days : [from],
    ))
      if (list.length) keys.add(key);
    return keys;
  }, [entries, days, from]);

  const step = (direction: 1 | -1) =>
    setAnchor((current) =>
      view === "month"
        ? addMonths(current, direction)
        : addDays(current, direction * stepDays(view, 7)),
    );
  const goToday = () => setAnchor(startOfDay(new Date()));
  const newEvent = (start?: Date) => {
    const s = start ?? nextHalfHour();
    setEditing({
      draft: {
        start: s,
        end: new Date(s.getTime() + 3_600_000),
        allDay: false,
      },
    });
  };

  /* Keyboard: T today, ←/→ (or J/K) to move, D 3 W M A for views, N new. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target) || shortcutsOwnedByEditor()) return;
      if (
        document.querySelector(
          "[role=dialog],[role=alertdialog],[data-radix-popper-content-wrapper]",
        )
      )
        return;
      const key = event.key.toLowerCase();
      const target = VIEWS.find((v) => v.key === key);
      if (target) setChosenView(target.id);
      else if (key === "t") goToday();
      else if (key === "arrowleft" || key === "k") step(-1);
      else if (key === "arrowright" || key === "j") step(1);
      else if (key === "n") newEvent();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!settings) {
    return (
      <ManagerWrapper>
        <LoadingState label="Loading your calendar" />
      </ManagerWrapper>
    );
  }

  const heading =
    view === "month"
      ? format(anchor, "MMMM yyyy")
      : view === "day"
        ? format(anchor, narrow ? "EEE d MMMM" : "EEEE d MMMM yyyy")
        : view === "agenda"
          ? `From ${format(anchor, "d MMMM")}`
          : isSameMonth(days[0], days[days.length - 1])
            ? `${format(days[0], "d")}–${format(days[days.length - 1], "d MMMM yyyy")}`
            : `${format(days[0], "d MMM")} – ${format(days[days.length - 1], "d MMM yyyy")}`;

  const hasHours = view === "day" || view === "3day" || view === "week";
  const phoneList = narrow && (view === "month" || view === "agenda");

  const openEntry = (entry: CalendarEntry, rect: DOMRect) => {
    setCreating(null);
    setSelected({ entry, anchor: rect });
  };
  const onCreate = (range: CreateRange, rect: DOMRect) => {
    setSelected(null);
    setCreating({ range, anchor: rect });
  };
  const editEntry = (entry: CalendarEntry) => {
    setSelected(null);
    if (entry.kind === "event") setEditing({ entry });
  };
  const deleteEntry = async (entry: CalendarEntry) => {
    const done = await actions.deleteEntry(entry);
    if (done) {
      setSelected(null);
      setEditing(null);
    }
  };
  const resetEntry = async (entry: CalendarEntry) => {
    if (await actions.resetOccurrence(entry)) {
      setSelected(null);
      setEditing(null);
    }
  };

  const panel = (
    <div className="space-y-6">
      <MiniMonth
        anchor={anchor}
        visibleDays={days}
        busyDays={busyDays}
        weekStartsOn={weekStartsOn}
        onPick={(day) => {
          setAnchor(day);
          setPanelSheet(false);
        }}
      />
      <section aria-label="Add" className="space-y-2">
        <Button
          className="w-full"
          onClick={() => {
            setPanelSheet(false);
            newEvent();
          }}
        >
          <Plus className="mr-1.5 size-4" aria-hidden /> New event
        </Button>
        <QuickAddBar defaultCalendarId={data.defaultCalendarId} />
      </section>
      <TaskRail
        tasks={data.tasks}
        scheduledTaskIds={data.scheduledTaskIds}
        onSchedule={(taskId) => void data.scheduleTask(taskId, nextHalfHour())}
      />
      <CalendarList calendars={data.calendars} settings={settings} />
      {hasHours && (
        <FreeTimeBar
          days={days}
          entries={entries}
          settings={settings}
          className="px-3.5"
        />
      )}
      {hasHours && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Hour size</p>
          <ToggleGroup
            type="single"
            value={density}
            onValueChange={(v) => v && setDensity(v as Density)}
            aria-label="Hour size"
            className="grid w-full grid-cols-3"
          >
            {DENSITY_OPTIONS.map((o) => (
              <ToggleGroupItem
                key={o.id}
                value={o.id}
                size="sm"
                className="px-1 text-xs"
              >
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}
    </div>
  );

  const viewOptions = VIEWS.filter((v) => !narrow || v.phone);

  return (
    <ManagerWrapper className="pb-4">
      <div className="flex gap-5">
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col gap-3",
            !phoneList && "h-[calc(100dvh-7rem-var(--tabbar-h))] min-h-[30rem]",
          )}
        >
          {/* One row from sm: ‹ Today › · range · view · overlays · panel. On a
              phone the range has its own line, so it is never squeezed out. */}
          <header className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <div className="flex shrink-0 items-center rounded-control border bg-card">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-r-none"
                onClick={() => step(-1)}
                aria-label="Previous"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                className="h-9 rounded-none border-x px-2.5 text-sm"
                onClick={goToday}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-l-none"
                onClick={() => step(1)}
                aria-label="Next"
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
            <h1 className="t-heading order-first min-w-0 basis-full truncate sm:order-none sm:flex-1 sm:basis-auto">
              {heading}
            </h1>
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setChosenView(v as CalendarView)}
              aria-label="View"
              className="hidden shrink-0 md:inline-flex"
            >
              {viewOptions.map((v) => (
                <ToggleGroupItem
                  key={v.id}
                  value={v.id}
                  size="sm"
                  className="px-2.5"
                  title={`${v.label} (${v.key.toUpperCase()})`}
                >
                  {v.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Select
              value={view}
              onValueChange={(v) => setChosenView(v as CalendarView)}
            >
              <SelectTrigger
                className="ml-auto h-9 w-auto shrink-0 md:hidden"
                aria-label="View"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {viewOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <OverlaysMenu
              settings={settings}
              onChange={(patch) => void data.saveSettings(patch)}
            />
            <Button
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              aria-label={
                belowLg
                  ? "Open the calendar panel"
                  : panelOpen
                    ? "Hide the calendar panel"
                    : "Show the calendar panel"
              }
              aria-pressed={belowLg ? undefined : panelOpen}
              onClick={() =>
                belowLg
                  ? setPanelSheet(true)
                  : setPanelChoice(panelOpen ? "closed" : "open")
              }
            >
              <PanelRight className="size-4" aria-hidden />
            </Button>
          </header>

          {!data.isLoading && (
            <GridStatus
              error={data.error}
              rows={data.rows}
              entries={entries}
              hiddenCalendarCount={data.hiddenCalendars.size}
              overlays={{
                tasks: settings.show_tasks ?? true,
                habits: settings.show_habits ?? false,
                finance: settings.show_finance ?? false,
              }}
            />
          )}

          {data.isLoading && data.rows.length === 0 ? (
            <LoadingState label="Loading" />
          ) : hasHours ? (
            <TimeGrid
              days={days}
              entries={entries}
              hourHeight={HOUR_HEIGHT[density]}
              scrollToHour={settings.day_start_hour ?? 7}
              selectedId={selected?.entry.id ?? null}
              draft={creating?.range ?? null}
              onSelect={openEntry}
              onEdit={editEntry}
              onCreate={onCreate}
              onMove={(entry, start, end) =>
                void data.moveEntry(entry, start, end)
              }
              onDropTask={(taskId, start) =>
                void data.scheduleTask(taskId, start)
              }
              onPickDay={(day) => {
                setAnchor(day);
                setChosenView("day");
              }}
            />
          ) : view === "month" ? (
            <>
              <MonthGrid
                days={days}
                month={anchor}
                entries={entries}
                compact={narrow}
                selectedDay={anchor}
                selectedId={selected?.entry.id ?? null}
                onSelectDay={(day) => setAnchor(day)}
                onSelect={openEntry}
                onCreate={onCreate}
                onPickDay={(day) => {
                  setAnchor(day);
                  setChosenView("day");
                }}
              />
              {narrow && (
                <div className="pt-1">
                  <AgendaList
                    days={[anchor]}
                    entries={entries}
                    selectedId={selected?.entry.id ?? null}
                    showEmpty
                    onSelect={openEntry}
                  />
                </div>
              )}
            </>
          ) : (
            <div
              className={cn(!narrow && "min-h-0 flex-1 overflow-y-auto pr-1")}
            >
              <AgendaList
                days={Array.from(
                  {
                    length:
                      Math.round((to.getTime() - from.getTime()) / 86_400_000) +
                      1,
                  },
                  (_, i) => addDays(from, i),
                )}
                entries={entries}
                selectedId={selected?.entry.id ?? null}
                emptyText="Nothing on the calendar for the next 30 days."
                onSelect={openEntry}
              />
            </div>
          )}
        </div>

        {panelOpen && !belowLg && (
          <aside
            aria-label="Calendar panel"
            className="hidden w-[17rem] shrink-0 self-start lg:block"
          >
            <div className="sticky top-20 max-h-[calc(100dvh-7rem-var(--tabbar-h))] overflow-y-auto pb-2 pr-1">
              {panel}
            </div>
          </aside>
        )}
      </div>

      {belowLg && (
        <Sheet open={panelSheet} onOpenChange={setPanelSheet}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Calendar</SheetTitle>
            </SheetHeader>
            <div className="mt-4">{panel}</div>
          </SheetContent>
        </Sheet>
      )}

      <EntryPopover
        entry={selected?.entry ?? null}
        anchor={selected?.anchor ?? null}
        compact={narrow}
        calendars={data.calendars}
        onClose={() => setSelected(null)}
        onEdit={editEntry}
        onDelete={(entry) => void deleteEntry(entry)}
        onReset={(entry) => void resetEntry(entry)}
      />
      <QuickCreate
        range={creating?.range ?? null}
        anchor={creating?.anchor ?? null}
        compact={narrow}
        onClose={() => setCreating(null)}
        onCreate={(title) =>
          creating
            ? data.createEvent({
                title,
                start: creating.range.start,
                end: creating.range.end,
                isAllDay: creating.range.allDay,
              })
            : Promise.resolve(false)
        }
        onMore={(title) => {
          if (!creating) return;
          setEditing({ draft: { ...creating.range, title } });
          setCreating(null);
        }}
      />
      <EventEditor
        entry={editing && "entry" in editing ? editing.entry : null}
        draft={editing && "draft" in editing ? editing.draft : null}
        calendars={data.calendars}
        defaultCalendarId={data.defaultCalendarId}
        onClose={() => setEditing(null)}
        onDelete={(entry) => void deleteEntry(entry)}
        onReset={(entry) => void resetEntry(entry)}
      />
    </ManagerWrapper>
  );
}

/** The next half hour from now: where a new block lands by default. */
function nextHalfHour(): Date {
  const start = new Date();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() < 30 ? 30 : 60);
  return start;
}
