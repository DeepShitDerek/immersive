import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockTracking } from "./lib/no-tracking.mjs";

/**
 * Browser check of the money module: every screen driven like a
 * person would — settings, accounts in Canada and India, expenses, splits,
 * a card payment, a remittance with its true cost, edits, a CSV import
 * (twice), rules, reconciliation, recurring bills and pay, budgets, goals,
 * persistence, and no screen wider than the window at 1280 and 390 px.
 *
 * Runs against the dev harness, which exists only in a harness build:
 *   NEXT_PUBLIC_DEV_HARNESS=1 TZ=UTC npm run build && npm run check:money
 * OUT overrides the export directory, BASE points at a running server
 * instead, SHOTS=<dir> saves screenshots, CHROME_PATH overrides the browser,
 * DUMP_STATE=<file> writes the finished ledger (scripts/fixtures/money-harness.json
 * is made this way).
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? path.join(root, "out");
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain",
  ".png": "image/png",
};
const server = createServer((req, res) => {
  let file = path.join(
    OUT,
    decodeURIComponent(new URL(req.url, "http://x").pathname),
  );
  if (existsSync(file) && statSync(file).isDirectory())
    file = path.join(file, "index.html");
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
});
if (!process.env.BASE)
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = process.env.BASE ?? `http://127.0.0.1:${server.address().port}`;
const port = 9500 + (process.pid % 300);
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
]
  .filter(Boolean)
  .find((candidate) => existsSync(candidate));
if (!CHROME) {
  console.error("Chrome not found; set CHROME_PATH.");
  process.exit(1);
}
if (!process.env.BASE && !existsSync(path.join(OUT, "dev", "money"))) {
  console.error(
    `No ${path.join(OUT, "dev", "money")} — build with NEXT_PUBLIC_DEV_HARNESS=1 first.`,
  );
  process.exit(1);
}
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "money-"))}`,
    "--window-size=1280,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);
let wsUrl;
for (let i = 0; i < 300 && !wsUrl; i++) {
  try {
    wsUrl = (
      await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    ).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
  await sleep(200);
}
// A busy runner can take a while to bring Chrome up; give up with a reason
// and not with a WebSocket error about an undefined address.
if (!wsUrl) {
  console.error("Chrome did not start within a minute.");
  chrome.kill();
  process.exit(1);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const errors = [];
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
    return;
  }
  if (msg.method === "Runtime.exceptionThrown")
    errors.push(
      msg.params.exceptionDetails.exception?.description?.split("\n")[0] ??
        msg.params.exceptionDetails.text,
    );
  if (
    msg.method === "Runtime.consoleAPICalled" &&
    (msg.params.type === "error" || msg.params.type === "warn")
  )
    errors.push(
      `${msg.params.type}: ` +
        msg.params.args
          .map((a) => a.value ?? a.description ?? "")
          .join(" ")
          .slice(0, 300),
    );
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++seq;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.result?.exceptionDetails)
    throw new Error(
      `eval failed: ${expression.slice(0, 120)} :: ${r.result.exceptionDetails.exception?.description?.split("\n")[0]}`,
    );
  return r.result?.result?.value;
};
await send("Runtime.enable");
await send("Page.enable");
await send("DOM.enable");
await blockTracking(send);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
};
const shot = async (name) => {
  if (!SHOTS) return;
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(
    path.join(SHOTS, `${name}.png`),
    Buffer.from(r.result.data, "base64"),
  );
};
async function waitFor(expr, label, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (
      await evaluate(
        `(() => { try { return ${expr}; } catch { return false; } })()`,
      )
    )
      return true;
    await sleep(80);
  }
  throw new Error(`timed out waiting for ${label}`);
}
const q = (s) => JSON.stringify(s);
/** Centre of the first element matching a JS expression that returns an element. */
async function clickEl(elExpr, label) {
  await waitFor(`!!(${elExpr})`, label);
  // A closing Radix menu leaves pointer-events: none on the body for a moment.
  // An open menu sets it too, deliberately, and its items are still clickable.
  await waitFor(
    `getComputedStyle(document.body).pointerEvents !== "none" || !!document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')`,
    "pointer events",
    3000,
  );
  // Sheets and popovers slide in: wait until the target stops moving.
  let last = "";
  for (let i = 0; i < 40; i += 1) {
    const now = await evaluate(
      `(() => { const r = (${elExpr}).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(","); })()`,
    );
    if (now === last) break;
    last = now;
    await sleep(60);
  }
  const box = await evaluate(
    `(() => { const el = ${elExpr}; el.scrollIntoView({block:"center", behavior:"instant"}); const r = el.getBoundingClientRect(); return {x: r.x + r.width/2, y: r.y + r.height/2}; })()`,
  );
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
      pointerType: "mouse",
    });
  }
  await sleep(120);
}
const byText = (selector, text) =>
  `[...document.querySelectorAll(${q(selector)})].find(e => e.offsetParent !== null && e.textContent.trim().includes(${q(text)}))`;
const byExactText = (selector, text) =>
  `[...document.querySelectorAll(${q(selector)})].find(e => e.offsetParent !== null && e.textContent.trim() === ${q(text)})`;
const button = (text) => clickEl(byText("button", text), `button "${text}"`);
const buttonExact = (text) =>
  clickEl(byExactText("button", text), `button "${text}"`);
async function type(id, text) {
  await waitFor(`!!document.getElementById(${q(id)})`, `#${id}`);
  if (await evaluate(`document.getElementById(${q(id)}).type === "date"`)) {
    // Date inputs ignore typed text; set it the way React's onChange sees it.
    await evaluate(
      `(() => { const el = document.getElementById(${q(id)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, ${q(text)}); el.dispatchEvent(new Event("input", { bubbles: true })); })()`,
    );
    await sleep(40);
    return;
  }
  await evaluate(
    `(() => { const el = document.getElementById(${q(id)}); el.focus(); el.select?.(); })()`,
  );
  // Typing lands wherever focus is. If focus did not arrive, say why rather
  // than typing into the previous field.
  const focusProblem = await evaluate(`(() => {
    const el = document.getElementById(${q(id)});
    if (document.activeElement === el) return null;
    const all = document.querySelectorAll("#" + CSS.escape(${q(id)}));
    return JSON.stringify({ copies: all.length, disabled: el.disabled, visible: el.getClientRects().length > 0, inert: !!el.closest("[inert]"), ariaHidden: !!el.closest("[aria-hidden=true]"), focus: document.activeElement?.id || document.activeElement?.tagName });
  })()`);
  if (focusProblem) throw new Error(`could not focus #${id}: ${focusProblem}`);
  if (text === "") {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Backspace",
      code: "Backspace",
      windowsVirtualKeyCode: 8,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Backspace",
      code: "Backspace",
      windowsVirtualKeyCode: 8,
    });
  } else {
    await send("Input.insertText", { text });
  }
  await sleep(40);
}
/**
 * Radix Select, entirely from the keyboard: open (focus + ArrowDown), type
 * the option's name (typeahead), Enter. The mouse is unreliable here — a
 * press opens the list with the current item under the pointer, and the
 * list auto-scrolls when the pointer nears its edge — so a scripted click
 * can land on a neighbour. Confirms the trigger shows the choice.
 */
const key = (k, code, keyCode, text) => [
  send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: k,
    code,
    windowsVirtualKeyCode: keyCode,
    ...(text ? { text } : {}),
  }),
  send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: k,
    code,
    windowsVirtualKeyCode: keyCode,
  }),
];
async function pick(id, option) {
  // Keyboard only, and deterministic: open with ArrowDown, go to the top with
  // Home, ArrowDown until the option is highlighted, Enter. Typeahead used to
  // choose here, but under React 19 its timing in automation was erratic (a
  // space in "Credit card" jumped to "Investment"; "NRO" stopped on "NRE"),
  // and the Escape that followed a miss reached the sheet behind the list.
  const listOpen = `!!document.querySelector('[role="listbox"]')`;
  const highlighted = `(document.activeElement?.getAttribute("role") === "option" ? document.activeElement : document.querySelector('[role="option"][data-highlighted]'))?.textContent.trim() ?? null`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitFor(`!!document.getElementById(${q(id)})`, `select #${id}`);
    await evaluate(
      `(() => { const el = document.getElementById(${q(id)}); el.scrollIntoView({ block: "center", behavior: "instant" }); el.focus(); })()`,
    );
    // The pointer off the page, so it cannot highlight what it rests over.
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: 0,
      y: 0,
      pointerType: "mouse",
    });
    await Promise.all(key("ArrowDown", "ArrowDown", 40));
    await waitFor(
      `document.activeElement?.getAttribute("role") === "option"`,
      "focus in the list",
      3000,
    ).catch(() => {});
    await Promise.all(key("Home", "Home", 36));
    await sleep(40);
    const total = await evaluate(
      `document.querySelectorAll('[role="option"]').length`,
    );
    let current = await evaluate(highlighted);
    for (
      let i = 0;
      i < total && current && !current.startsWith(option);
      i += 1
    ) {
      await Promise.all(key("ArrowDown", "ArrowDown", 40));
      await sleep(30);
      current = await evaluate(highlighted);
    }
    if (current && current.startsWith(option))
      await Promise.all(key("Enter", "Enter", 13, String.fromCharCode(13)));
    // Escape only closes an open list; with none open it would reach the sheet.
    else if (await evaluate(listOpen))
      await Promise.all(key("Escape", "Escape", 27));
    await waitFor(`!${listOpen}`, "select closed", 3000).catch(() => {});
    await sleep(100);
    if (
      await evaluate(
        `document.getElementById(${q(id)}).textContent.trim().startsWith(${q(option)})`,
      )
    ) {
      await evaluate(`document.activeElement?.blur()`);
      return;
    }
    await sleep(300);
  }
  throw new Error(`could not choose "${option}" in #${id}`);
}
/** CategoryPicker: open, search, choose. */
async function category(id, name) {
  await chooseCategory(
    `document.getElementById(${q(id)})`,
    `category #${id}`,
    name,
  );
}
/** A category picker (a searchable popover): open, search, choose. */
async function chooseCategory(triggerExpr, label, name) {
  await clickEl(triggerExpr, label);
  // Type only once the search box has focus; sooner, the text went elsewhere
  // and the list changed under the click (React 19 timing).
  await waitFor(
    `document.activeElement?.hasAttribute("cmdk-input")`,
    `${label} search`,
    3000,
  );
  await send("Input.insertText", { text: name });
  const item = `[...document.querySelectorAll('[cmdk-item]')].find(e => e.textContent.includes(${q(name)}))`;
  // The filter settles over a render or two; wait until the item is listed.
  await waitFor(
    `!!(${item}) && document.querySelector('[cmdk-input]')?.value === ${q(name)}`,
    `category "${name}" listed`,
    3000,
  );
  await sleep(100);
  await clickEl(item, `category "${name}"`);
}
const bodyHas = (text) =>
  evaluate(`document.body.innerText.includes(${q(text)})`);
async function area(label) {
  await clickEl(
    byExactText('nav[aria-label="Money sections"] button', label),
    `area ${label}`,
  );
  await sleep(300);
}
async function saveSheet(label = "Save") {
  await clickEl(
    `[...document.querySelectorAll('[role="dialog"] button[type="submit"]')].find(b => b.textContent.includes(${q(label)}))`,
    `sheet submit ${label}`,
  );
}
const sheetGone = () =>
  waitFor(`!document.querySelector('[role="dialog"]')`, "sheet closed", 8000);
// Dismissing a sheet with typed input asks first: answer Discard.
async function discardSheet() {
  await waitFor(
    `!!document.querySelector('[role="alertdialog"]')`,
    "discard prompt",
    3000,
  );
  await clickEl(
    byExactText('[role="alertdialog"] button', "Discard"),
    "discard",
  );
}

async function load() {
  await send("Page.navigate", { url: `${base}/dev/money/` });
  await waitFor(`document.body.innerText.includes("Net worth")`, "page", 30000);
  await sleep(300);
}

try {
  await load();
  await evaluate(`localStorage.removeItem("money-harness")`);
  await load();
  check(
    "the harness opens on the overview with a setup checklist",
    await bodyHas("Getting set up"),
  );

  // ── Settings ──
  await area("Settings");
  await pick("set-province", "Ontario");
  await type("set-birth", "1996");
  await type("set-needsPct", "55");
  await type("set-wantsPct", "25");
  await button("Save and start");
  try {
    await waitFor(
      `document.body.innerText.includes("Settings saved")`,
      "settings toast",
    );
  } catch (error) {
    console.log(
      "settings did not save:",
      await evaluate(
        `JSON.stringify({ alert: document.querySelector('[role="alert"]')?.textContent, needs: document.getElementById("set-needsPct").value, wants: document.getElementById("set-wantsPct").value, save: document.getElementById("set-savePct").value, birth: document.getElementById("set-birth").value, province: document.getElementById("set-province").textContent, active: document.activeElement?.id || document.activeElement?.tagName, toasts: [...document.querySelectorAll("[data-sonner-toast]")].map(t => t.textContent) })`,
      ),
    );
    throw error;
  }
  check("settings save", true);

  await button("Use the starter set");
  await waitFor(
    `document.body.innerText.includes("Groceries") && document.body.innerText.includes("Family in India")`,
    "starter categories",
    10000,
  );
  check("the starter categories appear", true);

  await type("rate-date", "2026-01-01");
  await type("rate-value", "61");
  await button("Save rate");
  await waitFor(`document.body.innerText.includes("Rate saved")`, "rate toast");
  check("a hand-entered INR rate saves", true);

  // ── Accounts ──
  await area("Accounts");
  await button("Add your first account");
  await type("acct-name", "RBC Chequing");
  await type("acct-opening", "1000");
  await type("acct-opening-date", "2026-01-01");
  await saveSheet("Add account");
  await sheetGone();
  check("a chequing account is added", await bodyHas("RBC Chequing"));

  await button("Add account");
  await type("acct-name", "Visa");
  await pick("acct-kind", "Credit card");
  await type("acct-opening-date", "2026-01-01");
  await type("acct-limit", "5000");
  await type("acct-statement", "15");
  await type("acct-due", "5");
  await saveSheet("Add account");
  await sheetGone();

  await button("Add account");
  await type("acct-name", "HDFC NRO");
  await pick("acct-kind", "Savings");
  await pick("acct-country", "India");
  await pick("acct-registration", "NRO");
  await pick("acct-institution", "New…");
  await type("acct-opening-date", "2026-01-01");
  await evaluate(
    `document.querySelector('[aria-label="New institution name"]').focus()`,
  );
  await send("Input.insertText", { text: "HDFC Bank" });
  await saveSheet("Add account");
  await sheetGone();
  check(
    "an Indian NRO account is added in rupees",
    (await bodyHas("HDFC NRO")) && (await bodyHas("NRO · HDFC Bank · India")),
  );

  // a TFSA in India is refused by the form
  await button("Add account");
  await type("acct-name", "Bad");
  await pick("acct-kind", "Savings");
  await pick("acct-registration", "TFSA");
  await pick("acct-country", "India");
  check(
    "changing country clears a Canadian-only registration",
    await evaluate(
      `document.getElementById("acct-registration").textContent.includes("Not registered")`,
    ),
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await discardSheet();
  await sheetGone();

  // ── Transactions ──
  await area("Transactions");
  await buttonExact("Transaction");
  await type("txn-date", "2026-02-03");
  await type("txn-payee", "Loblaws");
  await evaluate(
    `document.querySelector('input[aria-label^="Amount"]').focus()`,
  );
  await send("Input.insertText", { text: "45.20" });
  await chooseCategory(
    `[...document.querySelectorAll('[role="dialog"] button[role="combobox"]')].find(b => b.textContent.includes("Uncategorised"))`,
    "category trigger",
    "Groceries",
  );
  await saveSheet();
  await sheetGone();
  check(
    "an expense saves and shows with its category",
    (await bodyHas("Loblaws")) &&
      (await bodyHas("Groceries")) &&
      (await bodyHas("−$45.20")),
  );

  // Refused: empty amount
  await buttonExact("Transaction");
  await type("txn-description", "Nothing");
  await saveSheet();
  await waitFor(
    `!!document.querySelector('[role="dialog"] [role="alert"]')`,
    "form problems",
  );
  check(
    "an empty amount is refused in the form",
    await evaluate(
      `document.querySelector('[role="dialog"] [role="alert"]').textContent.includes("Enter an amount")`,
    ),
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await discardSheet();
  await sheetGone();

  // Income
  await buttonExact("Transaction");
  await clickEl(
    byExactText(
      '[role="dialog"] [role="radio"], [role="dialog"] button',
      "Income",
    ),
    "Income toggle",
  );
  await type("txn-date", "2026-02-15");
  await type("txn-payee", "Acme Corp");
  await type("txn-description", "Paycheque");
  await evaluate(
    `document.querySelector('input[aria-label^="Amount"]').focus()`,
  );
  await send("Input.insertText", { text: "2500" });
  await saveSheet();
  await sheetGone();

  // Card purchase split in two
  await buttonExact("Transaction");
  await type("txn-date", "2026-02-04");
  await type("txn-description", "Costco");
  await pick("txn-account", "Visa");
  await evaluate(
    `document.querySelector('input[aria-label^="Amount"]').focus()`,
  );
  await send("Input.insertText", { text: "80" });
  await button("Split");
  await evaluate(
    `document.querySelectorAll('input[aria-label^="Amount on line"]')[1].focus()`,
  );
  await send("Input.insertText", { text: "15.50" });
  check("a split shows its running total", await bodyHas("Total $95.50"));
  await saveSheet();
  await sheetGone();

  // Pay the card
  await buttonExact("Transaction");
  await clickEl(
    byExactText(
      '[role="dialog"] [role="radio"], [role="dialog"] button',
      "Transfer",
    ),
    "Transfer toggle",
  );
  await type("txn-date", "2026-02-16");
  await type("txn-description", "Pay the Visa");
  await pick("txn-from", "RBC Chequing");
  await pick("txn-to", "Visa");
  await type("txn-out", "95.50");
  await saveSheet();
  await sheetGone();

  // Send money home
  await buttonExact("Transaction");
  await clickEl(
    byExactText(
      '[role="dialog"] [role="radio"], [role="dialog"] button',
      "Transfer",
    ),
    "Transfer toggle",
  );
  await type("txn-date", "2026-02-20");
  await type("txn-description", "Money for parents");
  await pick("txn-from", "RBC Chequing");
  await pick("txn-to", "HDFC NRO");
  await type("txn-payee", "Wise");
  await type("txn-out", "1000");
  await waitFor(
    `document.body.innerText.includes("Use 61000.00")`,
    "received suggestion",
  );
  check("the form suggests what should arrive at the stored rate", true);
  await type("txn-in", "60000");
  await type("txn-fee", "4.99");
  await waitFor(
    `!!document.getElementById("txn-fee-category")`,
    "fee category",
  );
  check(
    "the fee picks the bank & transfer fees category by default",
    await evaluate(
      `document.getElementById("txn-fee-category").textContent.trim() === "Bank & transfer fees"`,
    ),
    await evaluate(`document.getElementById("txn-fee-category").textContent`),
  );
  await type("txn-market", "61");
  await waitFor(
    `document.body.innerText.includes("Against the market rate this cost")`,
    "remittance cost",
  );
  check(
    "the true cost of the remittance is shown",
    await bodyHas("$21.38 (2.14%)"),
    (await evaluate(
      `document.body.innerText.match(/Against the market rate this cost[^.]*/)?.[0]`,
    )) ?? "",
  );
  await shot("remittance");
  await saveSheet();
  await sheetGone();

  // Accounts now
  await area("Accounts");
  await waitFor(`document.body.innerText.includes("HDFC NRO")`, "accounts");
  check(
    "chequing balance is opening + every movement",
    await bodyHas("$2,354.31"),
    "1000 − 45.20 + 2500 − 95.50 − 1000 − 4.99",
  );
  check(
    "the NRO account holds exactly what arrived",
    await bodyHas("₹60,000.00"),
  );
  check(
    "the paid-off card shows nothing owed",
    await evaluate(`/\\$0\\.00\\s*owed/.test(document.body.innerText)`),
  );
  await shot("accounts");

  // Register for one account
  await clickEl(byText("button", "RBC Chequing"), "open register");
  await waitFor(
    `document.body.innerText.includes("Where did the money go?")`,
    "register",
  );
  check(
    "an account's register shows its running balance",
    await bodyHas("$2,354.31"),
  );

  // Edit the groceries amount
  await clickEl(byText("li button", "Loblaws"), "open Loblaws");
  await waitFor(`!!document.getElementById("txn-payee")`, "edit sheet");
  await evaluate(
    `document.querySelector('input[aria-label^="Amount"]').select()`,
  );
  await send("Input.insertText", { text: "50.20" });
  await saveSheet("Save changes");
  await sheetGone();
  check("an edit changes the balance", await bodyHas("$2,349.31"));

  // ── Import ──
  const csv = path.join(os.tmpdir(), `rbc-${process.pid}.csv`);
  writeFileSync(
    csv,
    [
      '"Account Type","Account Number","Transaction Date","Cheque Number","Description 1","Description 2","CAD$","USD$"',
      'Chequing,1,2/21/2026,,"TIM HORTONS #12","TORONTO",-2.50,',
      'Chequing,1,2/22/2026,,"PRESTO FARE","",-3.30,',
      'Chequing,1,2/22/2026,,"PRESTO FARE","",-3.30,',
    ].join("\n"),
  );
  await area("Import");
  await pick("import-account", "RBC Chequing");
  const doc = await send("DOM.getDocument", { depth: -1 });
  const node = await send("DOM.querySelector", {
    nodeId: doc.result.root.nodeId,
    selector: "#import-file",
  });
  await send("DOM.setFileInputFiles", {
    nodeId: node.result.nodeId,
    files: [csv],
  });
  await waitFor(
    `document.body.innerText.includes("3 to import")`,
    "import preview",
    8000,
  );
  check("an RBC-style export is read, identical rows kept apart", true);
  await shot("import-preview");
  await button("Import 3");
  await waitFor(
    `document.body.innerText.includes("Imported 3 transactions")`,
    "import toast",
    8000,
  );
  await pick("import-account", "RBC Chequing");
  const node2 = await send("DOM.querySelector", {
    nodeId: (await send("DOM.getDocument", { depth: -1 })).result.root.nodeId,
    selector: "#import-file",
  });
  await send("DOM.setFileInputFiles", {
    nodeId: node2.result.nodeId,
    files: [csv],
  });
  await waitFor(
    `document.body.innerText.includes("0 to import · 3 already in the ledger")`,
    "duplicate preview",
    8000,
  );
  check("re-importing the same file finds every row already there", true);

  // ── Rules ──
  await area("Rules");
  await buttonExact("Rule");
  await type("rule-pattern", "presto");
  await waitFor(
    `document.body.innerText.includes("Matches 2 of your transactions")`,
    "rule preview",
  );
  check("a rule previews its matches", true);
  await category("rule-category", "Transit pass");
  await saveSheet("Save rule");
  await sheetGone();
  await button("Categorise");
  await waitFor(
    `document.body.innerText.includes("Categorised 2 transactions")`,
    "categorised",
    8000,
  );
  check("rules categorise existing uncategorised transactions", true);

  // ── Reconcile ──
  await area("Accounts");
  // Reconcile lives in the account row's ⋯ menu.
  await clickEl(
    `document.querySelector('[aria-label="Actions: RBC Chequing"]')`,
    "account menu",
  );
  await clickEl(
    byExactText('[role="menuitem"]', "Check against a statement"),
    "reconcile",
  );
  await type("rec-date", "2026-02-28");
  await type("rec-balance", "2340.21");
  await waitFor(
    `document.body.innerText.includes("None — it matches")`,
    "reconcile matches",
  );
  check(
    "the ledger matches the statement to the cent",
    true,
    "2349.31 − 2.50 − 3.30 − 3.30",
  );
  await button("Save checkpoint");
  await waitFor(
    `document.body.innerText.includes("Matches the statement")`,
    "checkpoint",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await sheetGone();

  // ── Overview ──
  await area("Overview");
  await waitFor(`document.body.innerText.includes("Net worth")`, "overview");
  check(
    "the overview splits net worth by country",
    (await bodyHas("In Canada")) && (await bodyHas("In India")),
  );
  check(
    "the setup checklist is gone once everything is done",
    !(await bodyHas("Getting set up")),
  );
  await shot("overview");

  // ── Plan: bills & pay ──
  const todayIso = await evaluate(
    `new Intl.DateTimeFormat("en-CA").format(new Date())`,
  );
  const monthFirst = todayIso.slice(0, 8) + "01";
  await area("Plan");
  await waitFor(
    `document.body.innerText.includes("What repeats")`,
    "plan area",
  );
  await buttonExact("Schedule");
  await type("sch-name", "Rent");
  await type("sch-amount", "1400");
  await category("sch-category", "Rent");
  await type("sch-start", monthFirst);
  await saveSheet("Save");
  await sheetGone();
  await waitFor(
    `!!document.querySelector('[aria-label^="Record Rent due"]')`,
    "rent due",
  );
  check("a monthly bill starting this month shows as due", true);

  await buttonExact("Schedule");
  await clickEl(
    byExactText(
      '[role="dialog"] [role="radio"], [role="dialog"] button',
      "Income",
    ),
    "Income kind",
  );
  await type("sch-name", "Paycheque");
  await type("sch-amount", "2100");
  await pick("sch-frequency", "Twice a month");
  await type("sch-start", monthFirst);
  await saveSheet("Save");
  await sheetGone();

  await buttonExact("Schedule");
  await type("sch-name", "Hydro");
  await type("sch-amount", "60");
  await clickEl(`document.getElementById("sch-estimate")`, "estimate switch");
  await type("sch-start", monthFirst);
  await saveSheet("Save");
  await sheetGone();
  check(
    "schedules list with their next date",
    (await bodyHas("Twice a month")) && (await bodyHas("next ")),
  );

  await clickEl(
    `document.querySelector('[aria-label^="Record Rent due"]')`,
    "record rent",
  );
  await waitFor(
    `document.body.innerText.includes("Recorded Rent")`,
    "rent recorded",
  );
  await waitFor(
    `!document.querySelector('[aria-label^="Record Rent due ${monthFirst}"]')`,
    "rent gone from queue",
  );
  check("recording a due bill clears it from the queue", true);

  await clickEl(byText("button", "Enter amount"), "hydro enter amount");
  await waitFor(
    `document.body.innerText.includes("Record a due payment")`,
    "prefilled sheet",
  );
  check(
    "an estimated bill opens the form prefilled",
    await evaluate(
      `document.querySelector('input[aria-label^="Amount"]').value === "60.00"`,
    ),
  );
  await evaluate(
    `document.querySelector('input[aria-label^="Amount"]').select()`,
  );
  await send("Input.insertText", { text: "73.15" });
  await saveSheet();
  await sheetGone();
  await area("Transactions");
  check(
    "the recorded estimate keeps its real amount",
    await bodyHas("−$73.15"),
  );
  await area("Plan");
  const payDue = await evaluate(
    `document.querySelectorAll('[aria-label^="Record Paycheque due"]').length`,
  );
  if (payDue > 0) {
    // Skip lives in the row's ⋯ menu.
    await clickEl(
      `document.querySelector('[aria-label^="More actions: Paycheque due"]')`,
      "pay menu",
    );
    await clickEl(
      byExactText('[role="menuitem"]', "Skip this one"),
      "skip pay",
    );
    await sleep(500);
    check(
      "skipping removes an occurrence from the queue",
      (await evaluate(
        `document.querySelectorAll('[aria-label^="Record Paycheque due"]').length`,
      )) ===
        payDue - 1,
    );
  } else {
    check(
      "skipping removes an occurrence from the queue",
      true,
      "no pay due in this part of the month",
    );
  }

  // ── Plan: budgets ──
  await clickEl(byExactText('[role="tab"]', "Budgets"), "budgets tab");
  await waitFor(
    `!!document.querySelector('[aria-label="Budget for Housing"]')`,
    "budget rows",
  );
  await evaluate(
    `document.querySelector('[aria-label="Budget for Housing"]').focus()`,
  );
  await send("Input.insertText", { text: "1500" });
  await evaluate(
    `document.querySelector('[aria-label="Budget for Housing"]').blur()`,
  );
  await waitFor(
    `document.body.innerText.includes("$100.00 left")`,
    "budget left",
    8000,
  );
  check("a budget shows what is left after this month's rent", true);

  // ── Plan: goals ──
  await clickEl(byExactText('[role="tab"]', "Goals"), "goals tab");
  await buttonExact("Goal");
  await type("goal-name", "Trip home");
  await type("goal-target", "3000");
  await clickEl(
    `[...document.querySelectorAll('[role="dialog"] label')].find(l => l.textContent.includes("HDFC NRO"))?.querySelector('button')`,
    "link NRO",
  );
  await saveSheet("Save");
  await sheetGone();
  await waitFor(`document.body.innerText.includes("Trip home")`, "goal card");
  check(
    "a goal measures itself by its linked account",
    (await bodyHas("of $3,000.00")) && (await bodyHas("HDFC NRO")),
  );
  await shot("plan-goals");

  // ── Borrowing: loans ──
  await area("Accounts");
  await button("Add account");
  await type("acct-name", "Car loan");
  await pick("acct-kind", "Loan");
  await type("acct-opening", "20000");
  await type("acct-opening-date", "2026-01-01");
  await saveSheet("Add account");
  await sheetGone();
  await area("Borrowing");
  await waitFor(`document.body.innerText.includes("Car loan")`, "loan card");
  await buttonExact("Add terms");
  await type("loan-rate", "6");
  await type("loan-amort", "5");
  await type("loan-first", "2026-02-01");
  await waitFor(
    `document.querySelector('[role="dialog"]').innerText.includes("$386.66")`,
    "calculated payment",
  );
  check(
    "loan terms calculate the level payment",
    true,
    "20,000 at 6% over 5 years",
  );
  await saveSheet("Save terms");
  await sheetGone();
  await waitFor(
    `document.body.innerText.includes("Interest still to pay")`,
    "loan projection",
  );
  check(
    "a loan shows its payoff date and interest to come",
    (await bodyHas("$386.66")) && (await bodyHas("Paid off")),
  );
  await buttonExact("Record payment");
  await waitFor(
    `document.getElementById("txn-out")?.value !== undefined && document.getElementById("txn-out").value !== ""`,
    "payment sheet",
  );
  check(
    "a payment splits into principal and interest",
    await evaluate(
      `document.getElementById("txn-out")?.value === "286.66" && document.getElementById("txn-fee")?.value === "100.00"`,
    ),
    await evaluate(
      `[document.getElementById("txn-out")?.value, document.getElementById("txn-fee")?.value].join(" + ")`,
    ),
  );
  await saveSheet();
  await sheetGone();
  await waitFor(
    `document.body.innerText.includes("$19,713.34")`,
    "owed after payment",
    8000,
  );
  check("the payment lowers what is owed by the principal only", true);
  await shot("borrowing-loans");

  // ── Borrowing: pay down, credit, income ──
  await clickEl(byExactText('[role="tab"]', "Pay down"), "pay down tab");
  await waitFor(
    `document.body.innerText.includes("Highest interest first")`,
    "payoff plans",
  );
  check(
    "the payoff plans compare both orders",
    (await bodyHas("Smallest balance first")) &&
      (await bodyHas("Debt-free by")),
  );

  await clickEl(byExactText('[role="tab"]', "Credit"), "credit tab");
  await type("score-value", "250");
  await buttonExact("Add score");
  await sleep(300);
  check(
    "a score outside 300–900 is refused",
    !(await evaluate(
      `[...document.querySelectorAll("li")].some(l => l.innerText.includes("250"))`,
    )),
  );
  await type("score-value", "712");
  await buttonExact("Add score");
  await waitFor(
    `[...document.querySelectorAll("li")].some(l => l.innerText.includes("712"))`,
    "score row",
  );
  check(
    "a credit score is logged and cards show utilisation",
    (await bodyHas("712")) && (await bodyHas("Visa")),
  );

  await clickEl(byExactText('[role="tab"]', "Income"), "income tab");
  await clickEl(
    byExactText('button:not([role="tab"])', "Income"),
    "add income",
  );
  await type("inc-name", "Acme Corp");
  await type("inc-gross", "90000");
  await type("inc-start", "2025-06-01");
  await saveSheet("Save");
  await sheetGone();
  check(
    "an income source is saved",
    (await bodyHas("Acme Corp")) && (await bodyHas("$90,000.00")),
  );

  // ── Borrowing: an application and its lender report ──
  await clickEl(
    byExactText('[role="tab"]', "Applications"),
    "applications tab",
  );
  await buttonExact("Application");
  await type("app-lender", "TD");
  await type("app-rate", "4.5");
  await type("app-price", "500000");
  await type("app-down", "600000");
  await saveSheet("Save");
  await sleep(200);
  check(
    "a down payment above the price is refused",
    await evaluate(
      `document.querySelector('[role="dialog"] [role="alert"]')?.textContent.includes("more than the price") ?? false`,
    ),
  );
  await type("app-down", "50000");
  await saveSheet("Save");
  await sheetGone();
  await waitFor(
    `document.body.innerText.includes("Mortgage qualification")`,
    "application report",
    8000,
  );
  check(
    "a new application opens with a starter checklist",
    (await bodyHas("Passport")) && (await bodyHas("0 of 11 ready")),
  );
  await evaluate(
    `document.querySelector('[aria-label="Another document"]').focus()`,
  );
  await send("Input.insertText", { text: "Gift letter from parents" });
  await buttonExact("Add");
  await waitFor(
    `document.body.innerText.includes("0 of 12 ready")`,
    "doc added",
  );
  check("a document can be added to the checklist", true);
  check(
    "the lender report runs the stress test",
    (await bodyHas("6.50%")) &&
      (await bodyHas("GDS (limit 39%)")) &&
      (await bodyHas("Acme Corp")),
  );
  check(
    "the report counts the 10%-down insurance premium",
    await bodyHas("incl. 3.10% insurance"),
  );
  await shot("borrowing-report");
  await buttonExact("All applications");
  await waitFor(
    `document.body.innerText.includes("documents 0/12")`,
    "application list",
  );
  check("applications list their document progress", true);

  // ── Investing ──
  await area("Accounts");
  await button("Add account");
  await type("acct-name", "Wealthsimple TFSA");
  await pick("acct-kind", "Investment");
  await pick("acct-registration", "TFSA");
  await type("acct-opening", "5000");
  await type("acct-opening-date", "2026-01-01");
  await saveSheet("Add account");
  await sheetGone();
  await area("Investing");
  await clickEl(
    byExactText('[role="tab"]', "Securities & prices"),
    "prices tab",
  );
  await buttonExact("Security");
  await type("sec-symbol", "xeqt");
  await type("sec-name", "iShares Core Equity ETF");
  await saveSheet("Save");
  await sheetGone();
  check("a security is added, its symbol upper-cased", await bodyHas("XEQT"));

  await clickEl(byExactText('[role="tab"]', "Trades"), "trades tab");
  await buttonExact("Trade");
  await pick("tr-security", "XEQT");
  await type("tr-units", "100");
  await type("tr-price", "30");
  await waitFor(
    `document.querySelector('[role="dialog"]').innerText.includes("$3,000.00")`,
    "computed total",
  );
  check("units × price gives the total", true);
  await saveSheet("Save");
  await sheetGone();
  await buttonExact("Trade");
  await pick("tr-kind", "Sell");
  await pick("tr-security", "XEQT");
  await type("tr-units", "150");
  await type("tr-total", "4500");
  await saveSheet("Save");
  await sleep(200);
  check(
    "selling more than is held is refused",
    await evaluate(
      `document.querySelector('[role="dialog"] [role="alert"]')?.textContent.includes("Only 100 units") ?? false`,
    ),
  );
  await pick("tr-kind", "Dividend or distribution");
  await type("tr-total", "12.34");
  check(
    "a dividend defaults to the Dividends category",
    await evaluate(
      `document.getElementById("tr-category").textContent.includes("Dividends")`,
    ),
    await evaluate(`document.getElementById("tr-category").textContent`),
  );
  await saveSheet("Save");
  await sheetGone();
  check(
    "trades are listed",
    (await bodyHas("Buy · XEQT · 100 units")) &&
      (await bodyHas("Dividend or distribution · XEQT")),
  );

  await clickEl(
    byExactText('[role="tab"]', "Securities & prices"),
    "prices tab",
  );
  await pick("price-security", "XEQT");
  await type("price-value", "32.50");
  await buttonExact("Save price");
  await waitFor(`document.body.innerText.includes("32.5")`, "price saved");

  await clickEl(byExactText('[role="tab"]', "Holdings"), "holdings tab");
  await waitFor(
    `document.body.innerText.includes("Wealthsimple TFSA")`,
    "portfolio card",
  );
  check(
    "an account is worth its cash plus its holdings at market",
    await bodyHas("$5,262.34"),
    "5000 − 3000 + 12.34 + 100 × 32.50",
  );
  check(
    "the gain on paper is market value less cost",
    await bodyHas("$250.00"),
  );
  check(
    "the allocation is shown",
    (await bodyHas("By asset class")) && (await bodyHas("Stocks")),
  );
  await shot("investing-holdings");

  await clickEl(byExactText('[role="tab"]', "Contribution room"), "room tab");
  await type("room-amount", "7000");
  await buttonExact("Save");
  await waitFor(
    `document.body.innerText.includes("from the CRA")`,
    "room saved",
  );
  check("TFSA room comes from the CRA figure", await bodyHas("$7,000.00"));
  await shot("investing-room");

  await area("Transactions");
  await clickEl(
    byText("button", "Dividend or distribution — XEQT"),
    "dividend row",
  );
  await waitFor(`!!document.querySelector('[role="dialog"]')`, "sheet");
  check(
    "a trade's ledger entry is edited through the trade",
    await evaluate(
      `document.querySelector('[role="dialog"]').innerText.includes("From a trade")`,
    ),
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await sheetGone();

  // ── Forecast ──
  await area("Plan");
  await clickEl(byExactText('[role="tab"]', "Forecast"), "forecast tab");
  await waitFor(
    `document.body.innerText.includes("Spendable money, day by day")`,
    "forecast chart",
  );
  check(
    "the forecast plays schedules forward",
    (await bodyHas("Spendable today")) &&
      (await evaluate(`!!document.querySelector('figure [role="img"]')`)),
  );
  await type("wi-label", "Send home");
  await type("wi-amount", "300");
  await buttonExact("Try it");
  await waitFor(
    `document.body.innerText.includes("without what-ifs")`,
    "what-if applied",
  );
  check(
    "a what-if changes the line and is listed",
    (await bodyHas("Send home")) && (await bodyHas("· what-if")),
  );
  await shot("plan-forecast");

  // ── Reports ──
  await area("Reports");
  await waitFor(
    `document.body.innerText.includes("The last twelve months")`,
    "months report",
  );
  check("the months report totals income and spending", await bodyHas("Total"));
  await clickEl(byExactText('[role="tab"]', "Net worth"), "worth tab");
  await waitFor(
    `document.body.innerText.includes("Net worth, month by month")`,
    "worth report",
  );
  check(
    "net worth is shown month by month",
    await evaluate(
      `document.querySelectorAll('[aria-label="Net worth table"] tbody tr').length >= 2`,
    ),
  );
  await clickEl(byExactText('[role="tab"]', "Sending money"), "remittance tab");
  await waitFor(
    `document.body.innerText.includes("Cost, fees and rate margin")`,
    "remittance report",
  );
  check(
    "the remittance report finds the transfer home and its cost",
    await bodyHas("2.14%"),
  );
  await clickEl(byExactText('[role="tab"]', "Tax year"), "tax tab");
  await waitFor(
    `document.body.innerText.includes("figures for your return")`,
    "tax report",
  );
  check(
    "the tax year lists income and the T1135 check",
    (await bodyHas("Income (outside TFSA, RRSP and FHSA)")) &&
      (await evaluate(
        `/Total\\s*\\$[0-9,]+\\.\\d\\d/.test(document.getElementById("money-tax-year").innerText)`,
      )) &&
      (await bodyHas("no T1135 needed")),
  );
  await shot("reports-tax");

  // ── Insights ──
  await area("Overview");
  await waitFor(
    `document.body.innerText.includes("What stands out")`,
    "insights",
  );
  check(
    "the overview explains what stands out",
    (await bodyHas("of TFSA room unused")) &&
      (await bodyHas("Sending money cost $21.38 this year")),
  );
  await shot("overview-insights");

  // ── Nothing wider than the window, on every screen ──
  for (const width of [1280, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    for (const label of [
      "Overview",
      "Accounts",
      "Transactions",
      "Plan",
      "Investing",
      "Borrowing",
      "Reports",
      "Import",
      "Rules",
      "Settings",
    ]) {
      await area(label);
      const wide = await evaluate(
        `[...document.querySelectorAll("body *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('nav[aria-label="Money sections"]')).slice(0, 3).map(e => e.tagName + "." + String(e.className).slice(0, 60)).join(" | ")`,
      );
      check(
        `${label} fits a ${width}px window`,
        await evaluate(
          `document.documentElement.scrollWidth <= window.innerWidth + 1`,
        ),
        wide,
      );
    }
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // ── Persistence ──
  await load();
  await area("Accounts");
  check(
    "everything survives a reload",
    (await bodyHas("$480.40")) &&
      (await bodyHas("₹60,000.00")) &&
      (await bodyHas("$19,713.34")) &&
      (await bodyHas("$5,262.34")),
    "2340.21 − 1400 rent − 73.15 hydro − 386.66 loan",
  );

  // The finished ledger, for check-a11y's fixture (DUMP_STATE=<file>).
  if (process.env.DUMP_STATE)
    writeFileSync(
      process.env.DUMP_STATE,
      await evaluate(`localStorage.getItem("money-harness")`),
    );

  // ── Mobile ──
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await load();
  check(
    "no horizontal scroll on a phone",
    await evaluate(
      `document.documentElement.scrollWidth <= window.innerWidth + 1`,
    ),
    String(await evaluate("document.documentElement.scrollWidth")),
  );
  await shot("mobile");
} catch (error) {
  check(`script ran to the end`, false, error.message);
  // What the page looked like when it stopped: which overlay was open, where
  // focus was, what the fields held. A timeout alone says too little.
  try {
    const state = await evaluate(`JSON.stringify({
      url: location.pathname + location.search,
      focus: (() => { const a = document.activeElement; return a ? a.tagName + (a.id ? "#" + a.id : "") + "[" + (a.getAttribute("role") ?? "") + "] " + (a.textContent ?? "").trim().slice(0, 40) : null; })(),
      overlays: [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [role="listbox"]')].map((d) => d.getAttribute("role") + ": " + (d.getAttribute("aria-label") ?? d.querySelector("h2")?.textContent ?? "").trim().slice(0, 60)),
      alerts: [...document.querySelectorAll('[role="dialog"] [role="alert"], [data-sonner-toast]')].map((a) => a.textContent.trim().slice(0, 120)),
      fields: Object.fromEntries([...document.querySelectorAll('[role="dialog"] [id]')].filter((e) => e.matches("input, textarea, button[role=combobox]")).map((e) => [e.id, (e.matches("button") ? e.textContent : e.value ?? "").trim().slice(0, 40)])),
      bodyPointerEvents: getComputedStyle(document.body).pointerEvents,
    })`);
    console.log(`  state at failure: ${state}`);
    if (SHOTS) await shot("failure");
  } catch {
    // Diagnostics must never hide the failure itself.
  }
  await shot("failure");
}

check(
  "no console errors or warnings",
  errors.length === 0,
  errors.slice(0, 5).join(" | "),
);
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
ws.close();
chrome.kill();
if (!process.env.BASE) server.close();
process.exit(failed ? 1 : 0);
