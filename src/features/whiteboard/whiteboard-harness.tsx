"use client";

import type { Whiteboard } from "@/types";
import { whiteboardApi } from "@/store/api/admin/whiteboardApi";
import WhiteboardPage from "./whiteboard-page";

/**
 * The real whiteboard gallery and editor, with the four endpoints answered
 * by an in-memory table instead of Supabase, so drawing, autosave, close and
 * reopen can be exercised in a browser. The override is injected when this
 * module loads, which only the dev harness route does. Nothing persists past
 * a reload.
 */
const rows = new Map<string, Whiteboard>();
let nextId = 1;
const now = () => new Date().toISOString();
const listRow = ({
  elements: _e,
  app_state: _a,
  files: _f,
  ...rest
}: Whiteboard) => rest;

whiteboardApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getWhiteboards: builder.query<Whiteboard[], void>({
      queryFn: async () => ({
        data: [...rows.values()]
          .sort(
            (a, b) =>
              Number(!!b.is_pinned) - Number(!!a.is_pinned) ||
              (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
          )
          .map(listRow),
      }),
      providesTags: ["Whiteboards"],
    }),
    getWhiteboard: builder.query<Whiteboard, string>({
      queryFn: async (id) => {
        const row = rows.get(id);
        return row
          ? { data: structuredClone(row) }
          : { error: { status: 404, data: "No such board" } as never };
      },
      providesTags: ["Whiteboards"],
    }),
    saveWhiteboard: builder.mutation<Whiteboard, Partial<Whiteboard>>({
      queryFn: async (input) => {
        const id = input.id ?? `board-${nextId++}`;
        const previous = rows.get(id);
        const row: Whiteboard = {
          ...(previous ?? { created_at: now() }),
          ...structuredClone(input),
          id,
          updated_at: now(),
        };
        rows.set(id, row);
        (window as unknown as { __boards: Map<string, Whiteboard> }).__boards =
          rows;
        return { data: structuredClone(row) };
      },
      invalidatesTags: ["Whiteboards"],
    }),
    deleteWhiteboard: builder.mutation<{ id: string }, string>({
      queryFn: async (id) => {
        rows.delete(id);
        return { data: { id } };
      },
      invalidatesTags: ["Whiteboards"],
    }),
  }),
});

export function WhiteboardHarness() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          <WhiteboardPage />
        </div>
      </main>
    </div>
  );
}
