import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  isSupabaseConfigured: true,
  config: {
    supabase: {
      url: "https://abcd1234.supabase.co/",
      anonKey: "anon-key",
      bucketName: "assets",
    },
  },
}));

const { rest, publicStorageUrl, hasStoredSession } = await import("./rest");

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
function respond(status: number, body: unknown, statusText = "") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        statusText,
      });
    }),
  );
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const params = (url: string) => new URL(url).searchParams;

describe("rest", () => {
  it("builds a select with filters and orders the way supabase-js does", async () => {
    respond(200, [{ id: 1 }]);
    const { data, error } = await rest!
      .from("portfolio_sections")
      .select("id, title, portfolio_items ( id, title )")
      .eq("page_path", "/about")
      .eq("is_visible", true)
      .order("display_order")
      .order("created_at", { ascending: false })
      .order("display_order", { foreignTable: "portfolio_items" });
    expect(error).toBeNull();
    expect(data).toEqual([{ id: 1 }]);
    const url = calls[0].url;
    expect(
      url.startsWith(
        "https://abcd1234.supabase.co/rest/v1/portfolio_sections?",
      ),
    ).toBe(true);
    const p = params(url);
    expect(p.get("select")).toBe("id,title,portfolio_items(id,title)");
    expect(p.get("page_path")).toBe("eq./about");
    expect(p.get("is_visible")).toBe("eq.true");
    expect(p.get("order")).toBe("display_order.asc,created_at.desc");
    expect(p.get("portfolio_items.order")).toBe("display_order.asc");
    expect(calls[0].init.headers).toMatchObject({
      apikey: "anon-key",
      Authorization: "Bearer anon-key",
    });
  });

  it("keeps quoted spaces in a select string", async () => {
    respond(200, []);
    await rest!.from("t").select('a, "b c"');
    expect(params(calls[0].url).get("select")).toBe('a,"b c"');
  });

  it("asks for one object on single() and passes PostgREST's no-row error through", async () => {
    respond(406, {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
      details: "0 rows",
      hint: null,
    });
    const { data, error } = await rest!
      .from("site_identity")
      .select("*")
      .single();
    expect(calls[0].init.headers).toMatchObject({
      Accept: "application/vnd.pgrst.object+json",
    });
    expect(data).toBeNull();
    expect(error).toMatchObject({ code: "PGRST116", details: "0 rows" });
  });

  it("returns one row or null from maybeSingle(), and refuses two", async () => {
    respond(200, []);
    expect((await rest!.from("t").select().maybeSingle()).data).toBeNull();
    respond(200, [{ id: 1 }]);
    expect((await rest!.from("t").select().maybeSingle()).data).toEqual({
      id: 1,
    });
    respond(200, [{ id: 1 }, { id: 2 }]);
    expect((await rest!.from("t").select().maybeSingle()).error?.code).toBe(
      "PGRST116",
    );
  });

  it("inserts without reading back, and reports the database's refusal as it is", async () => {
    respond(201, undefined);
    const ok = await rest!.from("contact_submissions").insert({ name: "A" });
    expect(ok).toEqual({ data: null, error: null });
    expect(calls[0].init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ name: "A" }),
    });
    expect(calls[0].init.headers).toMatchObject({ Prefer: "return=minimal" });

    respond(400, {
      code: "P0001",
      message: "Too many messages from this address. Please try again later.",
      details: null,
      hint: null,
    });
    const refused = await rest!
      .from("contact_submissions")
      .insert({ name: "A" });
    expect(refused.error).toMatchObject({
      code: "P0001",
      message: expect.stringContaining("Too many messages"),
    });
  });

  it("words a network failure as supabase-js did, so the contact form still reads it as offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const { error } = await rest!.rpc("get_random_public_highlight");
    expect(error?.message).toBe("TypeError: Failed to fetch");
  });

  it("calls a function with its arguments", async () => {
    respond(200, [{ text: "x" }]);
    const { data } = await rest!.rpc("increment_blog_post_view", {
      post_id_to_increment: "p1",
    });
    expect(calls[0].url).toBe(
      "https://abcd1234.supabase.co/rest/v1/rpc/increment_blog_post_view",
    );
    expect(calls[0].init.body).toBe(
      JSON.stringify({ post_id_to_increment: "p1" }),
    );
    expect(data).toEqual([{ text: "x" }]);
  });

  it("reports a non-JSON failure by its status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("<html>", { status: 502, statusText: "Bad Gateway" }),
      ),
    );
    expect((await rest!.from("t").select()).error?.message).toBe(
      "502 Bad Gateway",
    );
  });

  it("builds storage URLs exactly as supabase-js's getPublicUrl", () => {
    expect(publicStorageUrl("assets", "/blog/a b.png")).toBe(
      "https://abcd1234.supabase.co/storage/v1/object/public/assets/blog/a%20b.png",
    );
  });

  it("sees a stored session only when it has a refresh token", () => {
    localStorage.clear();
    expect(hasStoredSession()).toBe(false);
    localStorage.setItem(
      "sb-abcd1234-auth-token",
      JSON.stringify({ access_token: "x" }),
    );
    expect(hasStoredSession()).toBe(false);
    localStorage.setItem(
      "sb-abcd1234-auth-token",
      JSON.stringify({ access_token: "x", refresh_token: "r" }),
    );
    expect(hasStoredSession()).toBe(true);
    localStorage.setItem("sb-abcd1234-auth-token", "not json");
    expect(hasStoredSession()).toBe(false);
  });
});
