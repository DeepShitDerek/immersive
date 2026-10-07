import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
  Static checks over db/schema.sql. There is no application server: every
  access rule is row-level security or a function, so a regression here is a
  data leak, not a bug. These tests do not replace running the policies against
  a real Postgres; they catch the mistakes that are visible in the text.
*/

const sql = readFileSync(
  path.resolve(__dirname, "../../db/schema.sql"),
  "utf8",
).replace(/--[^\n]*/g, "");

function tables(): string[] {
  return Array.from(
    sql.matchAll(/CREATE TABLE IF NOT EXISTS\s+(?:public\.)?(\w+)/gi),
    (m) => m[1],
  );
}

/** Each function definition, from CREATE to the end of its $$ body. */
function functions(): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  const re = /CREATE OR REPLACE FUNCTION\s+(?:public\.)?(\w+)\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql))) {
    const start = match.index;
    const open = sql.indexOf("$$", start);
    const close = sql.indexOf("$$", open + 2);
    const end = sql.indexOf(";", close);
    out.push({ name: match[1], text: sql.slice(start, end + 1) });
  }
  return out;
}

/*
  Definer functions that are meant to run for signed-out callers or from
  triggers fired by anonymous inserts. Each was reviewed by hand; adding a name
  here is a security decision and belongs in a reviewed commit.
*/
const PUBLIC_DEFINERS = new Set([
  "check_admin_exists",
  "block_additional_signups",
  "limit_contact_submissions",
  "notify_contact_submission",
  "enrich_site_visit",
  "limit_site_visits",
  "notify_site_visit",
  "increment_blog_post_view",
  "get_random_public_highlight",
]);

describe("db/schema.sql", () => {
  it("defines tables and functions (parser sanity)", () => {
    expect(tables().length).toBeGreaterThan(40);
    expect(functions().length).toBeGreaterThan(30);
  });

  it.each(tables())("table %s has row-level security enabled", (table) => {
    const enabled = new RegExp(
      `ALTER TABLE\\s+(?:public\\.)?${table}\\s+ENABLE ROW LEVEL SECURITY`,
      "i",
    );
    expect(sql).toMatch(enabled);
  });

  const definers = functions().filter((f) => /SECURITY DEFINER/i.test(f.text));

  it("has security-definer functions to check", () => {
    expect(definers.length).toBeGreaterThan(10);
  });

  it.each(definers.map((f) => [f.name, f.text]))(
    "definer %s pins its search_path",
    (_name, text) => {
      expect(text).toMatch(/SET search_path\s*=/i);
    },
  );

  it.each(
    definers
      .filter((f) => !PUBLIC_DEFINERS.has(f.name))
      .map((f) => [f.name, f.text]),
  )("definer %s checks the second factor itself", (name, text) => {
    // is_admin() includes is_aal2(); is_admin is the helper itself.
    const guarded =
      name === "is_admin" || /is_aal2\(\)|is_admin\(\)/i.test(text);
    expect(guarded).toBe(true);
  });

  /*
    Lockdown. Definer functions bypass the restrictive policies, so an
    admin-facing definer that writes must check the level itself.
  */
  it.each(
    definers
      .filter((f) => !PUBLIC_DEFINERS.has(f.name))
      .filter((f) =>
        /\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b/i.test(f.text),
      )
      .map((f) => [f.name, f.text]),
  )("writing definer %s refuses writes during lockdown", (_name, text) => {
    expect(text).toMatch(/IF public\.writes_locked\(\) THEN/i);
  });

  it("lockdown adds restrictive write policies to every table but its own", () => {
    const start = sql.indexOf(
      "CREATE OR REPLACE FUNCTION public.writes_locked",
    );
    expect(start).toBeGreaterThan(-1);
    const block = sql.slice(start);
    expect(block).toMatch(/c\.relname <> 'security_settings'/);
    for (const verb of ["INSERT", "UPDATE", "DELETE"]) {
      expect(block).toMatch(new RegExp(`AS RESTRICTIVE\\s+FOR ${verb}`, "i"));
    }
    // It must run after every table exists, or new tables go unprotected.
    const lastTable = sql.lastIndexOf("CREATE TABLE IF NOT EXISTS");
    expect(start).toBeGreaterThan(lastTable);
  });

  it("only the first account can ever sign up", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER block_additional_signups\s+BEFORE INSERT ON auth\.users/i,
    );
  });

  it("items of hidden sections are not public", () => {
    const policy =
      /CREATE POLICY "Public read items" ON portfolio_items[^;]*;/i.exec(
        sql,
      )?.[0];
    expect(policy).toBeDefined();
    expect(policy).not.toMatch(/USING \(true\)/i);
    expect(policy).toMatch(/portfolio_sections[\s\S]*is_visible = true/i);
  });

  it("anonymous visit inserts have a daily ceiling that bots can't opt out of", () => {
    const limiter = functions().find((f) => f.name === "limit_site_visits");
    const daily =
      /interval '24 hours'[\s\S]*?IF recent >= \d+ THEN\s+RETURN NULL/i.exec(
        limiter?.text ?? "",
      )?.[0];
    expect(daily).toBeDefined();
    expect(daily).not.toMatch(/is_bot/i);
  });

  it("the visit ping dedupes visits without a hash", () => {
    const notify = functions().find((f) => f.name === "notify_site_visit");
    expect(notify?.text).toMatch(
      /visitor_hash IS NOT DISTINCT FROM NEW\.visitor_hash/i,
    );
  });

  it("learning subject names are unique per owner, not globally", () => {
    expect(sql).toMatch(/learning_subjects\s*\(user_id, name\)/i);
    expect(sql).not.toMatch(
      /name TEXT NOT NULL UNIQUE,\s*description TEXT,\s*color/i,
    );
  });

  it("the analytics secret has no policies at all", () => {
    expect(sql).not.toMatch(/CREATE POLICY[^;]*ON\s+analytics_secret/i);
  });

  it("integration secrets are never publicly readable", () => {
    const policies = Array.from(
      sql.matchAll(/CREATE POLICY[^;]*ON\s+integration_settings[^;]*;/gi),
      (m) => m[0],
    );
    expect(policies.length).toBeGreaterThan(0);
    for (const policy of policies) expect(policy).toMatch(/is_admin\(\)/i);
  });
});
