import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EXPORT_TABLES,
  exportWorkspace,
  PAGE_SIZE,
  parseBackup,
} from "./workspace-export";

const LEFT_OUT = [
  "analytics_secret",
  "integration_settings",
  "site_visits",
  "money_currency",
  "money_rate",
];

/** A fake client: `rows[table]` served in ranges, or an error for `failing`. */
function fakeClient(rows: Record<string, number>, failing: string[] = []) {
  const ranges: [string, number, number][] = [];
  const client = {
    from(table: string) {
      const query = {
        select: () => query,
        order: () => query,
        range: async (from: number, to: number) => {
          ranges.push([table, from, to]);
          if (failing.includes(table))
            return { data: null, error: { message: "permission denied" } };
          const total = rows[table] ?? 0;
          const data = Array.from(
            { length: Math.max(0, Math.min(to, total - 1) - from + 1) },
            (_, i) => ({ n: from + i }),
          );
          return { data, error: null };
        },
      };
      return query;
    },
  };
  return { client: client as unknown as SupabaseClient, ranges };
}

describe("workspace backup", () => {
  it("covers every table in the schema except the ones left out on purpose", () => {
    const schema = readFileSync(
      resolve(__dirname, "../../../db/schema.sql"),
      "utf8",
    );
    const tables = [
      ...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g),
    ].map((m) => m[1]);
    const exported = EXPORT_TABLES.map((t) => t.table);
    expect(exported.filter((t) => !tables.includes(t))).toEqual([]);
    expect(
      tables.filter((t) => !exported.includes(t) && !LEFT_OUT.includes(t)),
    ).toEqual([]);
  });

  it("never carries secrets", () => {
    const exported = EXPORT_TABLES.map((t) => t.table);
    expect(exported).not.toContain("analytics_secret");
    expect(exported).not.toContain("integration_settings");
  });

  it("reads past PostgREST's 1,000-row cap, and keeps going when one table fails", async () => {
    const { client, ranges } = fakeClient({ habit_logs: 2 * PAGE_SIZE + 5 }, [
      "notes",
    ]);
    const progress = vi.fn();
    const backup = await exportWorkspace(
      client,
      progress,
      new Date("2026-09-25T12:00:00Z"),
    );
    expect(backup.tables.habit_logs).toHaveLength(2 * PAGE_SIZE + 5);
    expect(ranges.filter(([t]) => t === "habit_logs")).toHaveLength(3);
    expect(backup.errors).toEqual({ notes: "permission denied" });
    expect(backup.tables.notes).toBeUndefined();
    expect(backup.exported_at).toBe("2026-09-25T12:00:00.000Z");
    expect(progress).toHaveBeenLastCalledWith(
      EXPORT_TABLES.length,
      EXPORT_TABLES.length,
    );
  });
});

describe("restoring a backup", () => {
  it("restores exactly the tables it exports, in the database's own list", () => {
    const schema = readFileSync(
      resolve(__dirname, "../../../db/schema.sql"),
      "utf8",
    );
    const body =
      /workspace_restore_tables\(\)[\s\S]*?SELECT ARRAY\[([\s\S]*?)\]::TEXT\[\]/.exec(
        schema,
      )?.[1] ?? "";
    const restored = [...body.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    expect(restored).toEqual(EXPORT_TABLES.map((t) => t.table).sort());
  });

  it("reads back a backup it wrote, and refuses anything else", () => {
    const text = JSON.stringify({
      format: "two.oooo-workspace",
      version: 1,
      exported_at: "2026-09-25T12:00:00.000Z",
      tables: {
        notes: [{ id: "n1" }, { id: "n2" }],
        tasks: [{ id: "t1" }],
        habits: [],
      },
      errors: {},
    });
    expect(parseBackup(text)).toMatchObject({ ok: true, rows: 3, tables: 2 });
    expect(parseBackup("not json")).toEqual({
      ok: false,
      reason: "The file is not JSON.",
    });
    expect(parseBackup('{"format":"other","version":1,"tables":{}}').ok).toBe(
      false,
    );
    expect(
      parseBackup('{"format":"two.oooo-workspace","version":2,"tables":{}}').ok,
    ).toBe(false);
  });
});
