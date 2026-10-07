import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Behavioural database tests.
 *
 * The static checks in src/test/db-security.test.ts read schema.sql as text;
 * these run it. A throwaway supabase/postgres container gets the test shims,
 * then db/schema.sql twice (it claims to be idempotent, and the owner applies
 * it by re-running it), then db/test/10-policies.sql, which acts as anon, a
 * password-only session and the verified owner and asserts what each can do.
 *
 * Needs Docker. `npm run test:db`. Set KEEP_DB=1 to leave the container up.
 */

const IMAGE = process.env.SUPABASE_PG_IMAGE ?? "supabase/postgres:17.6.1.175";
const NAME = `foliokit-db-test-${process.pid}`;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Point at another schema file, e.g. an older version, to see which checks it fails.
const SCHEMA = process.env.SCHEMA ?? "db/schema.sql";
const file = (target) => readFileSync(path.resolve(root, target), "utf8");

function docker(args, input) {
  return spawnSync("docker", args, {
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function psql(user, sql, label, { allowFailure = false } = {}) {
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
      "-v",
      "ON_ERROR_STOP=1",
    ],
    sql,
  );
  if (result.status !== 0 && !allowFailure) {
    console.error(`\n✗ ${label} failed`);
    console.error((result.stdout ?? "").trim());
    console.error((result.stderr ?? "").trim());
    throw new Error(label);
  }
  if (result.status !== 0) {
    // Expected when a check failed (the suite's report raises), but it is
    // also how a suite that crashed half-way looks — so always show why.
    console.error(`\n${label}: ${(result.stderr ?? "").trim()}`);
  }
  return result.stdout ?? "";
}

function cleanup() {
  if (!process.env.KEEP_DB) docker(["rm", "-f", NAME]);
}

let exitCode = 1;
try {
  if (docker(["info"]).status !== 0) {
    throw new Error("Docker is not running");
  }

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

  // The entrypoint runs a temporary server for its init scripts, then restarts.
  // That first server answers queries too, and loading the schema into it
  // races the image's own event triggers — so wait for the init to announce
  // it is finished, then for the real server to answer.
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
  console.log(`▸ applying ${SCHEMA}`);
  psql("postgres", file(SCHEMA), "schema (first run)");
  psql("postgres", file(SCHEMA), "schema (re-run: idempotency)");
  console.log("✓ schema applies cleanly and re-applies cleanly");

  // Suites run in order and share the harness schema `t` that the first one
  // creates, and its owner account. Each ends by raising when a check failed;
  // the per-check lines before that are what we want either way.
  const suites = [
    ["db/test/10-policies.sql", "policy checks"],
    ["db/test/20-money.sql", "money ledger checks"],
    ["db/test/30-restore.sql", "restore checks"],
    ["db/test/40-posts.sql", "post checks"],
  ];
  const lines = suites.flatMap(([suite, label]) => {
    const found = psql("supabase_admin", file(suite), label, {
      allowFailure: true,
    })
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^(ok|NOT OK)\s/.test(line));
    // A suite that reports nothing crashed before its report: a failure,
    // not a pass with zero checks.
    return found.length > 0
      ? found
      : [`NOT OK 0 - ${suite} reported no checks`];
  });
  for (const line of lines)
    console.log(
      line.startsWith("ok") ? `✓ ${line.slice(7)}` : `✗ ${line.slice(7)}`,
    );

  const failed = lines.filter((line) => line.startsWith("NOT OK")).length;
  console.log(
    `\n${lines.length - failed}/${lines.length} database checks passed`,
  );
  exitCode = failed === 0 && lines.length > 0 ? 0 : 1;
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
} finally {
  cleanup();
}
process.exit(exitCode);
