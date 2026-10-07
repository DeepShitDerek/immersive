"use client";

import type { ContactSubmission } from "@/types";
import { inboxApi } from "@/store/api/admin/inboxApi";
import InboxPage from "./inbox-page";

/**
 * The real Inbox in the workspace frame, its message endpoints answered by an
 * in-memory table instead of Supabase, so reading, bulk actions and Undo can
 * be exercised in a browser. Injected when this module loads, which only the
 * dev harness route does. Placeholder messages; nothing persists past a
 * reload. Notifications still talk to the real project and are not used here.
 */
const day = (n: number, h = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const rows = new Map<string, ContactSubmission>(
  Array.from({ length: 9 }, (_, i): [string, ContactSubmission] => [
    `m${i}`,
    {
      id: `m${i}`,
      name: `Sender ${i + 1}`,
      email: `sender${i + 1}@example.test`,
      subject: `Sample subject ${i + 1}`,
      message: `Sample message ${i + 1}. ${"A second line of placeholder text. ".repeat((i % 3) + 1)}`,
      topic: (["role", "project", "other", null] as const)[i % 4],
      is_read: i % 3 !== 0,
      is_archived: i === 8,
      replied_at: i % 4 === 1 ? day(i) : null,
      created_at: day(i, 9 + i),
    },
  ]),
);
(globalThis as unknown as { __inbox: typeof rows }).__inbox = rows;

inboxApi.injectEndpoints({
  overrideExisting: true,
  endpoints: (builder) => ({
    getContactSubmissions: builder.query<ContactSubmission[], void>({
      queryFn: async () => ({
        data: [...rows.values()].map((r) => ({ ...r })),
      }),
      providesTags: ["Inbox"],
    }),
    updateContactSubmission: builder.mutation<
      ContactSubmission,
      Partial<ContactSubmission> & { id: string }
    >({
      queryFn: async ({ id, ...changes }) => {
        const row = { ...rows.get(id)!, ...changes };
        rows.set(id, row);
        return { data: row };
      },
      invalidatesTags: ["Inbox"],
    }),
    updateContactSubmissions: builder.mutation<
      null,
      { ids: string[]; changes: Partial<ContactSubmission> }
    >({
      queryFn: async ({ ids, changes }) => {
        for (const id of ids) rows.set(id, { ...rows.get(id)!, ...changes });
        return { data: null };
      },
      invalidatesTags: ["Inbox"],
    }),
    deleteContactSubmission: builder.mutation<{ id: string }, string>({
      queryFn: async (id) => {
        rows.delete(id);
        return { data: { id } };
      },
      invalidatesTags: ["Inbox"],
    }),
  }),
});

export function InboxHarness() {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-secondary/30">
      <header className="sticky top-0 z-chrome flex h-14 shrink-0 items-center border-b bg-card px-4 sm:px-6">
        Workspace
      </header>
      <main className="flex-1 px-4 pb-6 pt-6 sm:px-6">
        <div className="mx-auto w-full max-w-wide">
          <InboxPage />
        </div>
      </main>
    </div>
  );
}
