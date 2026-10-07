import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi } from "vitest";

// Records each table's filters; every table answers with one row.
const calls: Record<string, unknown[][]> = {};
vi.mock("@/supabase/client", () => ({
  supabase: {
    from(table: string) {
      calls[table] = [];
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "ilike", "is", "eq", "or", "order"]) {
        chain[method] = (...args: unknown[]) => {
          calls[table].push([method, ...args]);
          return chain;
        };
      }
      const row =
        table === "contact_submissions"
          ? { id: "m1", name: "Ada", subject: "Hello, (again)" }
          : { id: `${table}-1`, title: "" };
      chain.limit = async () => ({ data: [row], error: null });
      return chain;
    },
  },
}));

const { adminApi } = await import("./baseApi");
const { likePattern, searchApi } = await import("./searchApi");

describe("palette search", () => {
  it("takes the term's own wildcards literally", () => {
    // 50%_off\  →  %50\%\_off\\%
    expect(likePattern("50%_off\\")).toBe("%50\\%\\_off\\\\%");
  });

  it("finds records across modules and links each to where it opens", async () => {
    const store = configureStore({
      reducer: { [adminApi.reducerPath]: adminApi.reducer },
      middleware: (d) => d().concat(adminApi.middleware),
    });
    const { data } = await store.dispatch(
      searchApi.endpoints.searchWorkspace.initiate("a,b)"),
    );
    expect(data?.map((h) => [h.kind, h.title, h.href])).toEqual([
      ["note", "Untitled note", "/admin/notes/?note=notes-1"],
      ["task", "", "/admin/tasks/?task=tasks-1"],
      ["post", "Untitled post", "/admin/blog/?post=blog_posts-1"],
      ["message", "Hello, (again) — Ada", "/admin/inbox/?message=m1"],
    ]);
    // Commas and parentheses in the term stay inside the quoted value.
    expect(calls.contact_submissions).toContainEqual([
      "or",
      'subject.ilike."%a,b)%",name.ilike."%a,b)%"',
    ]);
    expect(calls.notes).toContainEqual(["is", "archived_at", null]);
  });
});
