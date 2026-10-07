"use client";

import type {
  Calendar,
  CalendarRow,
  CalendarSettings,
  Event,
  EventException,
  Task,
} from "@/types";
import { calendarApi } from "@/store/api/admin/calendarApi";
import { calendarSetupApi } from "@/store/api/admin/calendarSetupApi";
import { tasksApi } from "@/store/api/admin/tasksApi";
import { moneyApi } from "@/features/money/data/money-api";
import CalendarPage from "./calendar-page";

/**
 * The real Calendar in the workspace frame, with an in-memory events table
 * behind the same endpoints, so creating, moving, resizing and deleting can
 * be exercised in a browser. Placeholder events around today; nothing
 * persists past a reload. Injected when this module loads, which only the
 * dev harness route does. The table is on window.__calendar for probes.
 */
type Row = Record<string, unknown> & {
  id: string;
  title: string;
  start_time: string;
};

let settings: CalendarSettings = {
  day_start_hour: 7,
  day_end_hour: 21,
  week_starts_on: 1,
  default_view: "week",
  show_tasks: true,
  show_habits: false,
  show_finance: false,
};
const CALENDARS = [
  {
    id: "00000000-0000-4000-8000-0000000000c1",
    name: "Personal",
    color_token: "chart-1",
    is_visible: true,
    is_default: true,
  },
  {
    id: "00000000-0000-4000-8000-0000000000c2",
    name: "Work",
    color_token: "chart-5",
    is_visible: true,
  },
] as unknown as Calendar[];

function at(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const events = new Map<string, Row>(
  (
    [
      {
        id: "e1",
        title: "Sample event",
        start_time: at(0, 10),
        end_time: at(0, 11),
        calendar_id: "00000000-0000-4000-8000-0000000000c1",
      },
      {
        id: "e2",
        title: "Sample meeting",
        start_time: at(0, 10, 30),
        end_time: at(0, 11, 30),
        calendar_id: "00000000-0000-4000-8000-0000000000c2",
        location: "Room 2",
      },
      {
        id: "e3",
        title: "Weekly sample",
        start_time: at(-14, 9),
        end_time: at(-14, 9, 30),
        calendar_id: "00000000-0000-4000-8000-0000000000c2",
        rrule: "FREQ=WEEKLY",
      },
      {
        id: "e4",
        title: "Sample trip",
        start_time: at(1, 0),
        end_time: at(3, 0),
        is_all_day: true,
        calendar_id: "00000000-0000-4000-8000-0000000000c1",
      },
      // A busy day, for how a crowded month cell reads.
      ...[8, 9, 11, 13, 15, 17].map((h, i) => ({
        id: `busy${i}`,
        title: `Busy day item ${i + 1}`,
        start_time: at(2, h),
        end_time: at(2, h + 1),
        calendar_id:
          i % 2
            ? "00000000-0000-4000-8000-0000000000c2"
            : "00000000-0000-4000-8000-0000000000c1",
      })),
    ] as Row[]
  ).map((r) => [r.id, r]),
);
const exceptions = new Map<string, EventException>();
let nextId = 1;
(globalThis as unknown as { __calendar: unknown }).__calendar = {
  events,
  exceptions,
};

const TASK_DUE = new Date();
const TASKS = [
  {
    id: "k1",
    title: "Unscheduled sample task",
    status: "todo",
    estimate_minutes: 30,
  },
] as unknown as Task[];

function rows(): CalendarRow[] {
  const out: CalendarRow[] = [...events.values()].map((e) => ({
    item_id: e.id,
    title: e.title,
    start_time: e.start_time,
    end_time: (e.end_time as string | null) ?? null,
    item_type: "event",
    is_all_day: Boolean(e.is_all_day),
    data: {
      calendar_id: e.calendar_id ?? null,
      location: e.location ?? null,
      meeting_url: e.meeting_url ?? null,
      description: e.description ?? null,
      rrule: e.rrule ?? null,
      task_id: e.task_id ?? null,
    },
  }));
  out.push({
    item_id: "t1",
    title: "Sample task due",
    start_time: `${TASK_DUE.getFullYear()}-${String(TASK_DUE.getMonth() + 1).padStart(2, "0")}-${String(TASK_DUE.getDate()).padStart(2, "0")}T00:00:00+00:00`,
    end_time: null,
    item_type: "task",
    is_all_day: true,
    data: {},
  });
  return out;
}

calendarApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getCalendarData: b.query<CalendarRow[], { start: string; end: string }>({
      queryFn: async () => ({ data: rows() }),
      providesTags: ["Calendar"],
    }),
    addEvent: b.mutation<Event, Partial<Event>>({
      queryFn: async (input) => {
        const row = { ...(input as Row), id: `new-${nextId++}` };
        events.set(row.id, row);
        return { data: row as unknown as Event };
      },
      invalidatesTags: ["Calendar"],
    }),
    updateEvent: b.mutation<Event, Partial<Event>>({
      queryFn: async (input) => {
        const row = { ...events.get(input.id!)!, ...(input as Row) };
        events.set(row.id, row);
        return { data: row as unknown as Event };
      },
      invalidatesTags: ["Calendar"],
    }),
    deleteEvent: b.mutation<{ id: string }, string>({
      queryFn: async (id) => {
        events.delete(id);
        return { data: { id } };
      },
      invalidatesTags: ["Calendar"],
    }),
  }),
});
calendarSetupApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getCalendars: b.query<Calendar[], void>({
      queryFn: async () => ({ data: CALENDARS }),
      providesTags: ["CalendarSetup"],
    }),
    getEventExceptions: b.query<EventException[], void>({
      queryFn: async () => ({ data: [...exceptions.values()] }),
      providesTags: ["Calendar"],
    }),
    saveEventException: b.mutation<EventException, Partial<EventException>>({
      queryFn: async (input) => {
        const row = {
          is_cancelled: false,
          ...input,
          id: `x-${nextId++}`,
        } as EventException;
        exceptions.set(row.id, row);
        return { data: row };
      },
      invalidatesTags: ["Calendar"],
    }),
    deleteEventException: b.mutation<{ id: string }, string>({
      queryFn: async (id) => {
        exceptions.delete(id);
        return { data: { id } };
      },
      invalidatesTags: ["Calendar"],
    }),
    getCalendarSettings: b.query<CalendarSettings, void>({
      queryFn: async () => ({ data: { ...settings } }),
      providesTags: ["CalendarSetup"],
    }),
    saveCalendarSettings: b.mutation<null, Partial<CalendarSettings>>({
      queryFn: async (changes) => {
        settings = { ...settings, ...changes };
        return { data: null };
      },
      invalidatesTags: ["CalendarSetup", "Calendar"],
    }),
  }),
});
tasksApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getTasks: b.query<Task[], void>({ queryFn: async () => ({ data: TASKS }) }),
  }),
});
moneyApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (b) => ({
    getSchedules: b.query<never[], void>({
      queryFn: async () => ({ data: [] }),
    }),
    getSkips: b.query<string[], void>({ queryFn: async () => ({ data: [] }) }),
    getAccounts: b.query<never[], void>({
      queryFn: async () => ({ data: [] }),
    }),
  }),
});

export function CalendarHarness() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          <CalendarPage />
        </div>
      </main>
    </div>
  );
}
