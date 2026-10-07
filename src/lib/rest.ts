import { config, isSupabaseConfigured } from "@/lib/config";

/**
 * A small PostgREST client for the public site.
 *
 * The public pages read a handful of tables, call two functions and insert
 * one row — nothing that needs supabase-js's auth, realtime or storage
 * clients, which cost every visitor ~59 KB gzipped. This speaks to the same
 * REST endpoint with `fetch`, with the same anon key, the same row-level
 * security, and the same result shape (`{ data, error }`, the error being
 * PostgREST's own `{ code, message, details, hint }`), so callers written
 * against supabase-js read the same.
 *
 * Admin screens keep supabase-js: they need the signed-in session.
 */

interface RestError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

// Rows are whatever the select string asks for; callers cast to their types,
// exactly as they did with supabase-js's untyped client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;
type RestResult<T> =
  | { data: T; error: null }
  | { data: null; error: RestError };

const base = () => `${config.supabase.url.replace(/\/$/, "")}/rest/v1`;
const headers = (
  extra: Record<string, string> = {},
): Record<string, string> => ({
  apikey: config.supabase.anonKey,
  Authorization: `Bearer ${config.supabase.anonKey}`,
  ...extra,
});

/** supabase-js strips whitespace outside double quotes from a select string; so does this. */
const compactSelect = (columns: string) =>
  columns.replace(/\s(?=(?:[^"]*"[^"]*")*[^"]*$)/g, "");

async function send<T>(
  url: string,
  init: RequestInit,
  parse: "json" | "none",
): Promise<RestResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    // The wording supabase-js used, which the contact form's classifier reads.
    return {
      data: null,
      error: {
        message: `TypeError: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
  if (!response.ok) {
    let body: Partial<RestError> = {};
    try {
      body = (await response.json()) as Partial<RestError>;
    } catch {
      // Not JSON (a proxy's HTML error page, say): report the status.
    }
    return {
      data: null,
      error: {
        message: body.message ?? `${response.status} ${response.statusText}`,
        code: body.code,
        details: body.details ?? null,
        hint: body.hint ?? null,
      },
    };
  }
  if (parse === "none") return { data: null as T, error: null };
  const text = await response.text();
  return { data: (text ? JSON.parse(text) : null) as T, error: null };
}

class Select<T = Row> implements PromiseLike<RestResult<T[]>> {
  private readonly params = new URLSearchParams();
  private readonly orders: string[] = [];

  constructor(
    private readonly table: string,
    columns: string,
  ) {
    this.params.set("select", compactSelect(columns));
  }

  eq(column: string, value: string | number | boolean): this {
    this.params.append(column, `eq.${value}`);
    return this;
  }

  /** Like supabase-js: `foreignTable` orders an embedded resource. */
  order(
    column: string,
    options: { ascending?: boolean; foreignTable?: string } = {},
  ): this {
    const term = `${column}.${options.ascending === false ? "desc" : "asc"}`;
    if (options.foreignTable)
      this.params.append(`${options.foreignTable}.order`, term);
    else this.orders.push(term);
    return this;
  }

  private url(): string {
    const params = new URLSearchParams(this.params);
    if (this.orders.length) params.set("order", this.orders.join(","));
    return `${base()}/${this.table}?${params}`;
  }

  /** Exactly one row, or PostgREST's PGRST116 error (as supabase-js). */
  single(): Promise<RestResult<T>> {
    return send<T>(
      this.url(),
      { headers: headers({ Accept: "application/vnd.pgrst.object+json" }) },
      "json",
    );
  }

  /** One row or null; more than one is an error (as supabase-js). */
  async maybeSingle(): Promise<RestResult<T | null>> {
    const result = await this;
    if (result.error) return result;
    const rows = result.data ?? [];
    if (rows.length > 1)
      return {
        data: null,
        error: {
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
        },
      };
    return { data: rows[0] ?? null, error: null };
  }

  then<A = RestResult<T[]>, B = never>(
    onfulfilled?: ((value: RestResult<T[]>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return send<T[]>(
      this.url(),
      { headers: headers({ Accept: "application/json" }) },
      "json",
    ).then(onfulfilled, onrejected);
  }
}

export interface RestClient {
  from(table: string): {
    select<T = Row>(columns?: string): Select<T>;
    /** Insert without reading back — anon has no SELECT on what it writes. */
    insert(row: object): Promise<RestResult<null>>;
  };
  rpc<T = Row>(fn: string, args?: object): Promise<RestResult<T>>;
}

const client: RestClient = {
  from: (table) => ({
    select: (columns = "*") => new Select(table, columns),
    insert: (row) =>
      send<null>(
        `${base()}/${table}`,
        {
          method: "POST",
          headers: headers({
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          }),
          body: JSON.stringify(row),
        },
        "none",
      ),
  }),
  rpc: (fn, args = {}) =>
    send(
      `${base()}/rpc/${fn}`,
      {
        method: "POST",
        headers: headers({ "Content-Type": "application/json" }),
        body: JSON.stringify(args),
      },
      "json",
    ),
};

/** The REST client, or null in static mode (no Supabase settings) — like `supabase` from supabase/client. */
export const rest: RestClient | null = isSupabaseConfigured ? client : null;

/** A file's public URL in the storage bucket, exactly as supabase-js's `getPublicUrl` builds it. */
export function publicStorageUrl(bucket: string, path: string): string {
  return encodeURI(
    `${config.supabase.url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path.replace(/^\/+/, "")}`,
  );
}

/**
 * Whether this browser holds a Supabase session, read from where
 * supabase-js keeps it, without loading supabase-js. For display only — the
 * header's admin link, the lockdown screen — never for access: every rule
 * lives in the database.
 */
export function hasStoredSession(): boolean {
  if (!isSupabaseConfigured || typeof window === "undefined") return false;
  try {
    const ref = new URL(config.supabase.url).hostname.split(".")[0];
    const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return false;
    const stored = JSON.parse(raw) as { refresh_token?: string } | null;
    return !!stored?.refresh_token;
  } catch {
    return false;
  }
}
