/**
 * Where a fresh install stands, before anyone can sign in.
 *
 * - `no-database` — no Supabase keys at build time: a static site, which is
 *   complete as a public site but has no workspace to sign in to.
 * - `no-schema` — Supabase answers, but `db/schema.sql` has not been run, so
 *   the functions and tables sign-in depends on do not exist.
 * - `unreachable` — the request failed for some other reason (offline, a
 *   paused project). Sign-in is still offered; its own error will say more.
 * - `ready` — the schema is in place.
 *
 * The admin-exists check used to swallow every failure and answer "yes", so a
 * buyer who had not run the schema got an ordinary login form that could
 * never work, with nothing to say why.
 */
export type SetupStatus = "no-database" | "no-schema" | "unreachable" | "ready";

/** PostgREST and Postgres codes for "that function or table is not there". */
const MISSING_CODES = new Set(["PGRST202", "PGRST205", "42883", "42P01"]);

export function classifySetupError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): SetupStatus {
  if (!error) return "ready";
  if (error.code && MISSING_CODES.has(error.code)) return "no-schema";
  const message = (error.message ?? "").toLowerCase();
  if (
    message.includes("could not find the function") ||
    message.includes("schema cache") ||
    (message.includes("relation") && message.includes("does not exist"))
  ) {
    return "no-schema";
  }
  return "unreachable";
}
