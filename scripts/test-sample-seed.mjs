import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Runs the sample person's seed (db/john-doe.sample.sql) for real.
 *
 * A seed that is only ever read drifts: a column is renamed, a rule is
 * tightened, and the file a new owner runs on day one fails half-way. So, in
 * a throwaway supabase/postgres container: the schema, one owner account,
 * then the seed twice. It has to apply cleanly both times, add nothing the
 * second time, leave the public site readable by a visitor and the workspace
 * readable by the owner and by nobody else.
 *
 * Needs Docker. `npm run test:seed`. Set KEEP_DB=1 to leave the container up.
 */

const IMAGE = process.env.SUPABASE_PG_IMAGE ?? "supabase/postgres:17.6.1.175";
const NAME = `foliokit-seed-test-${process.pid}`;
const OWNER = "00000000-0000-0000-0000-00000000000a";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = (target) => readFileSync(path.resolve(root, target), "utf8");

function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function psql(user, sql, label) {
  const result = docker(
    [
      "exec",
      "-i",
      NAME,
      "psql",
      "-U",
      user,
      "-d",
      "postgres",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    sql,
  );
  if (result.status !== 0) {
    console.error(`\n✗ ${label} failed`);
    console.error((result.stdout ?? "").trim());
    console.error((result.stderr ?? "").trim());
    throw new Error(label);
  }
  return (result.stdout ?? "").trim();
}

/** `table count` lines for everything the seed writes. */
const COUNTS = `
SELECT string_agg(what || ' ' || n, E'\\n' ORDER BY what) FROM (
  SELECT 'blog_posts' AS what, count(*) AS n FROM blog_posts
  UNION ALL SELECT 'calendars', count(*) FROM calendars
  UNION ALL SELECT 'contact_submissions', count(*) FROM contact_submissions
  UNION ALL SELECT 'discover_places', count(*) FROM discover_places
  UNION ALL SELECT 'discover_topics', count(*) FROM discover_topics
  UNION ALL SELECT 'discover_watchlist', count(*) FROM discover_watchlist
  UNION ALL SELECT 'events', count(*) FROM events
  UNION ALL SELECT 'habit_logs', count(*) FROM habit_logs
  UNION ALL SELECT 'habits', count(*) FROM habits
  UNION ALL SELECT 'inventory_items', count(*) FROM inventory_items
  UNION ALL SELECT 'learning_sessions', count(*) FROM learning_sessions
  UNION ALL SELECT 'learning_subjects', count(*) FROM learning_subjects
  UNION ALL SELECT 'learning_topics', count(*) FROM learning_topics
  UNION ALL SELECT 'library_highlights', count(*) FROM library_highlights
  UNION ALL SELECT 'library_sources', count(*) FROM library_sources
  UNION ALL SELECT 'money_account', count(*) FROM money_account
  UNION ALL SELECT 'money_budget', count(*) FROM money_budget
  UNION ALL SELECT 'money_category', count(*) FROM money_category
  UNION ALL SELECT 'money_goal', count(*) FROM money_goal
  UNION ALL SELECT 'money_posting', count(*) FROM money_posting
  UNION ALL SELECT 'money_transaction', count(*) FROM money_transaction
  UNION ALL SELECT 'navigation_links', count(*) FROM navigation_links
  UNION ALL SELECT 'notes', count(*) FROM notes
  UNION ALL SELECT 'portfolio_items', count(*) FROM portfolio_items
  UNION ALL SELECT 'portfolio_sections', count(*) FROM portfolio_sections
  UNION ALL SELECT 'public_notes', count(*) FROM public_notes
  UNION ALL SELECT 'sub_tasks', count(*) FROM sub_tasks
  UNION ALL SELECT 'task_projects', count(*) FROM task_projects
  UNION ALL SELECT 'tasks', count(*) FROM tasks
) c;`;

const asOwner = (sql) => `
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","sub":"${OWNER}","aal":"aal2"}', true);
SET LOCAL ROLE authenticated;
${sql}
COMMIT;`;
const asVisitor = (sql) => `
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SET LOCAL ROLE anon;
${sql}
COMMIT;`;

const failures = [];
const check = (label, ok, detail = "") => {
  if (!ok) failures.push(label);
  console.log(
    `${ok ? "✓" : "✗"} ${label}${ok || !detail ? "" : ` (${detail})`}`,
  );
};
const number = (text) => Number(text.split("\n").filter(Boolean).pop());

let exitCode = 1;
try {
  if (docker(["info"]).status !== 0) throw new Error("Docker is not running");

  console.log(`▸ starting ${IMAGE}`);
  const run = docker([
    "run",
    "-d",
    "--name",
    NAME,
    "-e",
    "POSTGRES_PASSWORD=postgres",
    IMAGE,
  ]);
  if (run.status !== 0) throw new Error(run.stderr);

  // As in test-db.mjs: wait for the image's own init to finish, then for the
  // real server to answer.
  let ready = false;
  for (let i = 0; i < 180 && !ready; i++) {
    const logs = docker(["logs", NAME]);
    const initDone = /init process complete/i.test(
      `${logs.stdout}${logs.stderr}`,
    );
    const probe = initDone
      ? docker(["exec", NAME, "psql", "-U", "postgres", "-tAc", "select 1"])
      : { status: 1, stdout: "" };
    ready = probe.status === 0 && probe.stdout.trim() === "1";
    if (!ready)
      spawnSync(
        process.platform === "win32" ? "timeout" : "sleep",
        process.platform === "win32" ? ["/t", "1", "/nobreak"] : ["1"],
        { stdio: "ignore", shell: process.platform === "win32" },
      );
  }
  if (!ready) throw new Error("database did not become ready");

  psql("supabase_admin", file("db/test/00-supabase-shims.sql"), "shims");
  psql("postgres", file("db/schema.sql"), "schema");

  const seed = file("db/john-doe.sample.sql");

  // Before there is an account, the seed must stop with an instruction, and
  // leave the database as it found it (the schema seeds a few rows itself).
  const untouched = psql("postgres", COUNTS, "counts");
  const early = docker(
    [
      "exec",
      "-i",
      NAME,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    seed,
  );
  check(
    "with no account yet, the seed stops and says what to do",
    early.status !== 0 && /create your account/i.test(early.stderr ?? ""),
    (early.stderr ?? "").trim().split("\n")[0],
  );
  check(
    "and changes nothing",
    psql("postgres", COUNTS, "counts") === untouched,
  );

  psql(
    "supabase_admin",
    `INSERT INTO auth.users (id, email, created_at) VALUES ('${OWNER}', 'owner@example.com', now() - interval '1 day');`,
    "owner account",
  );

  psql("postgres", seed, "seed (first run)");
  const first = psql("postgres", COUNTS, "counts");
  psql("postgres", seed, "seed (second run)");
  const second = psql("postgres", COUNTS, "counts");
  console.log(
    first
      .split("\n")
      .map((line) => `  ${line}`)
      .join("\n"),
  );
  check("the seed applies cleanly, and again", true);
  check("a second run adds nothing", first === second);

  const count = Object.fromEntries(
    first
      .split("\n")
      .map((line) => line.split(" "))
      .map(([k, v]) => [k, Number(v)]),
  );
  const empty = Object.entries(count)
    .filter(([, n]) => n === 0)
    .map(([k]) => k);
  check("every seeded table has rows", empty.length === 0, empty.join(", "));
  check(
    "the ledger balances: every transfer has two sides",
    count.money_posting > count.money_transaction,
  );

  // What a visitor sees.
  check(
    "a visitor reads the 3 published posts, not the draft",
    number(
      psql(
        "postgres",
        asVisitor("SELECT count(*) FROM (SELECT id, title FROM blog_posts) p;"),
        "anon posts",
      ),
    ) === 3,
  );
  check(
    "a visitor reads the 5 published updates, not the draft",
    number(
      psql(
        "postgres",
        asVisitor(
          "SELECT count(*) FROM (SELECT id, title FROM public_notes) n;",
        ),
        "anon updates",
      ),
    ) === 5,
  );
  check(
    "a visitor reads both case studies",
    number(
      psql(
        "postgres",
        asVisitor(
          "SELECT count(*) FROM (SELECT slug, case_study FROM portfolio_items WHERE has_case_study) c;",
        ),
        "anon case studies",
      ),
    ) === 2,
  );
  const visitorTasks = docker(
    [
      "exec",
      "-i",
      NAME,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    asVisitor("SELECT count(*) FROM tasks;"),
  );
  check(
    "a visitor reads none of the workspace",
    visitorTasks.status !== 0 || number(visitorTasks.stdout ?? "") === 0,
  );

  // What the owner sees: the rows are theirs, so row-level security shows them.
  const owner = (table) =>
    number(
      psql(
        "postgres",
        asOwner(`SELECT count(*) FROM ${table};`),
        `owner ${table}`,
      ),
    );
  for (const table of [
    "tasks",
    "notes",
    "events",
    "habits",
    "learning_topics",
    "library_sources",
    "inventory_items",
    "money_account",
    "money_transaction",
  ]) {
    check(
      `the owner sees their ${table}`,
      owner(table) === count[table],
      `${owner(table)} of ${count[table]}`,
    );
  }
  const nameless = number(
    psql(
      "postgres",
      "SELECT count(*) FROM tasks WHERE user_id IS NULL;",
      "ownerless",
    ),
  );
  check("no workspace row is left without an owner", nameless === 0);

  // The template's sample person is John Doe and nobody else.
  check(
    "no real person's name is in the seed",
    !/akshay|bharadva|amico/i.test(seed),
  );

  console.log(
    `\n${failures.length === 0 ? "All sample-seed checks passed" : `${failures.length} sample-seed check(s) failed`}`,
  );
  exitCode = failures.length === 0 ? 0 : 1;
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
} finally {
  if (!process.env.KEEP_DB) docker(["rm", "-f", NAME]);
}
process.exit(exitCode);
