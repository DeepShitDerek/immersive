import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Does the live database have what this build asks for?
 *
 * The public site names its columns instead of `select=*`, so a column
 * the code expects but the database lacks is no longer ignored — the whole
 * query fails and every visitor sees the section's error state. That happens
 * when code is deployed before `db/schema.sql` has been re-run on the
 * project. This runs before the build and refuses to deploy in that order.
 *
 * Read-only: each probe is a GET with `limit=0` and the public anon key, the
 * same access every visitor's browser has. Skipped in static mode (no
 * Supabase settings). Reads process.env, or .env when run locally.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = { ...process.env };
  const file = path.join(root, ".env");
  if (existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match && env[match[1]] === undefined) {
        env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  }
  return env;
}

/** The select strings the public site sends, read from their one source. */
function publicSelects() {
  const source = readFileSync(
    path.join(root, "src/store/api/public-columns.ts"),
    "utf8",
  );
  const constant = (name) => {
    const match = new RegExp(`${name}\\s*=\\s*"([^"]+)"`).exec(source);
    if (!match) throw new Error(`${name} not found in public-columns.ts`);
    return match[1];
  };
  return [
    ["blog_posts", constant("PUBLIC_BLOG_POST_SELECT")],
    ["blog_posts", constant("PUBLIC_BLOG_LIST_SELECT")],
    ["portfolio_sections", constant("PUBLIC_SECTION_WITH_ITEMS_SELECT")],
    ["portfolio_items", constant("PUBLIC_CASE_STUDY_SELECT")],
    // The contact form writes these. Visitors can't read the table (no
    // SELECT policy), but the column list is still resolved, so a missing
    // column fails the probe while existing rows stay invisible.
    ["contact_submissions", "name,email,subject,message,topic"],
    // Admin: the Maps editor. Same idea — rows stay hidden.
    [
      "thinking_maps",
      "id,name,doc,schema_version,revision,node_count,edge_count,is_pinned",
    ],
    // Admin: the money module — one probe per table the screens
    // load on open, so a deploy before schema.sql is re-run stops here
    // instead of at an error screen.
    ["money_settings", "base_currency,home_currency,resident_since"],
    [
      "money_account",
      "id,kind,registration,currency,opening_balance_minor,is_liquid",
    ],
    [
      "money_transaction",
      "id,date,kind,status,market_rate,schedule_id,occurrence_date",
    ],
    [
      "money_posting",
      "account_id,category_id,amount_minor,fx_rate,base_amount_minor",
    ],
    ["money_schedule", "id,kind,frequency,amount_minor,to_amount_minor"],
    ["money_goal", "id,target_minor,currency"],
    ["money_loan", "id,account_id,compounding,payment_frequency,term_months"],
    ["money_income_source", "id,gross_annual_minor,start_date"],
    ["money_credit_score", "id,bureau,score,as_of"],
    ["money_application", "id,product,status,purchase_price_minor"],
    ["money_application_doc", "id,application_id,name,status"],
    ["money_security", "id,symbol,asset_class,region"],
    ["money_price", "security_id,date,price"],
    ["money_trade", "id,kind,quantity,amount_minor,fee_minor,transaction_id"],
    ["money_room", "id,registration,year,room_minor"],
    // Workspace columns added after the first schema: inventory currency and archive reason, project archive,
    // task completion, focus logs, and the titles the palette searches.
    ["inventory_items", "id,currency,archived_reason,transaction_id"],
    ["task_projects", "id,is_archived"],
    ["tasks", "id,title,status,completed_at,recurrence_parent_id,updated_at"],
    ["focus_logs", "duration_minutes,mode,start_time"],
    ["notes", "id,title,archived_at,updated_at"],
  ];
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log("Static mode (no Supabase settings): nothing to check.");
  process.exit(0);
}

let failed = 0;
for (const [table, select] of publicSelects()) {
  const probe = `${url}/rest/v1/${table}?select=${encodeURIComponent(
    select.replace(/\s+/g, ""),
  )}&limit=0`;
  let status;
  let body = "";
  try {
    const response = await fetch(probe, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    status = response.status;
    body = await response.text();
  } catch (error) {
    console.error(`✗ ${table}: could not reach the database (${error})`);
    failed += 1;
    continue;
  }
  if (status === 200) {
    console.log(`✓ ${table}: every requested column exists`);
  } else {
    failed += 1;
    let message = body;
    try {
      message = JSON.parse(body).message ?? body;
    } catch {
      // Not JSON; print as is.
    }
    console.error(`✗ ${table}: ${message}`);
  }
}

// Functions the admin calls that anon may not run: probed as anon, where
// "permission denied" proves the function exists and "not found" (404) means
// the schema is behind. Nothing runs: anon has no EXECUTE on these.
const ADMIN_FUNCTIONS = [["restore_workspace", { backup: null }]];
for (const [fn, args] of ADMIN_FUNCTIONS) {
  let status;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    status = response.status;
  } catch (error) {
    console.error(`✗ ${fn}(): could not reach the database (${error})`);
    failed += 1;
    continue;
  }
  if (status === 404) {
    console.error(`✗ ${fn}(): missing`);
    failed += 1;
  } else if (status >= 200 && status < 300) {
    console.error(`✗ ${fn}(): anon was allowed to run it`);
    failed += 1;
  } else {
    console.log(`✓ ${fn}(): present, and closed to anon`);
  }
}

if (failed > 0) {
  console.error(
    "\nThe live database is behind this code. Re-run db/schema.sql in the " +
      "Supabase SQL editor, then deploy again.",
  );
  process.exit(1);
}
console.log("\nLive database matches what the public site asks for.");
