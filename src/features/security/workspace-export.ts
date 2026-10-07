import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A backup of everything the owner has written, as one JSON file.
 *
 * Notes, tasks, habits, learning and the ledger otherwise exist only in a
 * free Supabase project that has to be kept awake by a workflow.
 *
 * Left out on purpose:
 * - `analytics_secret` and `integration_settings`: secrets and tokens. A
 *   backup file ends up in Downloads, in cloud sync and in email; it must not
 *   carry credentials.
 * - `site_visits`: visitors' traffic, not the owner's work, and the largest
 *   table by far.
 * - `money_currency` and `money_rate`: reference data the schema seeds and
 *   the rate job refills.
 *
 * Each table is read in pages: PostgREST returns at most 1,000 rows a call.
 */
export const EXPORT_TABLES: readonly {
  table: string;
  order: readonly string[];
}[] = [
  ...[
    "site_identity",
    "navigation_links",
    "security_settings",
    "portfolio_sections",
    "portfolio_items",
    "blog_posts",
    "task_projects",
    "tasks",
    "sub_tasks",
    "task_dependencies",
    "notes",
    "whiteboards",
    "thinking_maps",
    "calendars",
    "events",
    "event_exceptions",
    "learning_subjects",
    "learning_topics",
    "learning_sessions",
    "learning_reviews",
    "habits",
    "habit_logs",
    "focus_logs",
    "inventory_items",
    "storage_assets",
    "public_notes",
    "contact_submissions",
    "discover_watchlist",
    "discover_places",
    "discover_topics",
    "library_sources",
    "library_highlights",
    "money_institution",
    "money_account",
    "money_category",
    "money_import_batch",
    "money_transaction",
    "money_posting",
    "money_reconciliation",
    "money_rule",
    "money_schedule",
    "money_budget",
    "money_goal",
    "money_loan",
    "money_income_source",
    "money_credit_score",
    "money_application",
    "money_application_doc",
    "money_security",
    "money_price",
    "money_trade",
    "money_room",
  ].map((table) => ({ table, order: ["id"] })),
  // No `id` column: ordered by their key instead.
  { table: "calendar_settings", order: ["user_id"] },
  { table: "money_settings", order: ["user_id"] },
  { table: "money_schedule_skip", order: ["schedule_id", "due_date"] },
  { table: "money_goal_account", order: ["goal_id", "account_id"] },
];

export const PAGE_SIZE = 1000;

export interface WorkspaceExport {
  format: "two.oooo-workspace";
  version: 1;
  exported_at: string;
  tables: Record<string, unknown[]>;
  /** Tables that could not be read, and why; the rest is still usable. */
  errors: Record<string, string>;
}

async function readTable(
  client: SupabaseClient,
  table: string,
  order: readonly string[],
): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client.from(table).select("*");
    for (const column of order)
      query = query.order(column, { ascending: true });
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

export async function exportWorkspace(
  client: SupabaseClient,
  onProgress?: (done: number, total: number) => void,
  now = new Date(),
): Promise<WorkspaceExport> {
  const result: WorkspaceExport = {
    format: "two.oooo-workspace",
    version: 1,
    exported_at: now.toISOString(),
    tables: {},
    errors: {},
  };
  let done = 0;
  // One table at a time: a burst of 56 parallel reads is how a free project
  // gets rate-limited, and a backup is not in a hurry.
  for (const { table, order } of EXPORT_TABLES) {
    try {
      result.tables[table] = await readTable(client, table, order);
    } catch (error) {
      result.errors[table] =
        error instanceof Error ? error.message : String(error);
    }
    onProgress?.(++done, EXPORT_TABLES.length);
  }
  return result;
}

/**
 * A backup file read back in for restore: the file's own claim checked
 * before anything is sent. The database checks it again.
 */
export function parseBackup(
  text: string,
):
  | { ok: true; backup: WorkspaceExport; rows: number; tables: number }
  | { ok: false; reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: "The file is not JSON." };
  }
  const backup = parsed as Partial<WorkspaceExport> | null;
  if (
    !backup ||
    backup.format !== "two.oooo-workspace" ||
    backup.version !== 1
  ) {
    return {
      ok: false,
      reason: "The file is not a workspace backup this version can read.",
    };
  }
  if (!backup.tables || typeof backup.tables !== "object") {
    return { ok: false, reason: "The backup has no tables." };
  }
  const counts = Object.values(backup.tables).map((rows) =>
    Array.isArray(rows) ? rows.length : 0,
  );
  return {
    ok: true,
    backup: backup as WorkspaceExport,
    rows: counts.reduce((a, b) => a + b, 0),
    tables: counts.filter((n) => n > 0).length,
  };
}

/**
 * Restore through `restore_workspace` (db/schema.sql): one transaction, merge
 * only; rows that exist are kept. Returns rows added per table.
 */
export async function restoreWorkspace(
  client: SupabaseClient,
  backup: WorkspaceExport,
): Promise<Record<string, number>> {
  const { data, error } = await client.rpc("restore_workspace", { backup });
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, number>;
}
