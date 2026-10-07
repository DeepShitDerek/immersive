import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockTracking } from "./lib/no-tracking.mjs";

/**
 * WCAG 2.2 AA scan: axe-core in headless Chrome over every public
 * page (in the light and dark Ink themes), every area and tab of the money
 * module with a realistic ledger loaded, a money form open, the Maps
 * editor, and the three immersive layouts in each immersive style. Fails on any WCAG violation not in ALLOW below — each exception
 * carries its reason.
 *
 * Needs a harness build (for /dev/money and /dev/maps):
 *   NEXT_PUBLIC_DEV_HARNESS=1 TZ=UTC npm run build && npm run check:a11y
 * OUT overrides the export directory, CHROME_PATH the browser, ONLY=<substring>
 * limits the run to matching page labels.
 *
 * What axe cannot judge (focus order, dragging alternatives, meaning) is
 * checked by hand: see .ai/plans/V2-060-wcag-22-aa.md.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? path.join(root, "out");
const ONLY = process.env.ONLY;
const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const MONEY_STATE = readFileSync(
  path.join(root, "scripts", "fixtures", "money-harness.json"),
  "utf8",
);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Known, reasoned exceptions: rule id → { where, why }. Keep this short. */
const ALLOW = {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
};
const server = createServer((req, res) => {
  let file = path.join(
    OUT,
    decodeURIComponent(new URL(req.url, "http://x").pathname),
  );
  if (existsSync(file) && statSync(file).isDirectory())
    file = path.join(file, "index.html");
  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/html" });
    return createReadStream(path.join(OUT, "404.html")).pipe(res);
  }
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
  });
  createReadStream(file).pipe(res);
});
if (!existsSync(path.join(OUT, "dev", "money"))) {
  console.error(
    `No ${path.join(OUT, "dev", "money")} — build with NEXT_PUBLIC_DEV_HARNESS=1 first.`,
  );
  process.exit(1);
}
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

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
const port = 9200 + (process.pid % 300);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "a11y-"))}`,
    "--window-size=1280,1000",
    "about:blank",
  ],
  { stdio: "ignore" },
);
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try {
    wsUrl = (
      await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    ).find((t) => t.type === "page")?.webSocketDebuggerUrl;
  } catch {}
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
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
      `eval failed: ${expression.slice(0, 100)} :: ${r.result.exceptionDetails.exception?.description?.split("\n")[0]}`,
    );
  return r.result?.result?.value;
};
async function waitFor(expr, label, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (
      await evaluate(
        `(() => { try { return ${expr}; } catch { return false; } })()`,
      )
    )
      return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${label}`);
}
await send("Runtime.enable");
await send("Page.enable");
await blockTracking(send);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
// Reduced motion: entrance animations would otherwise be measured half-faded.
await send("Emulation.setEmulatedMedia", {
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});

async function open(url, storage = {}) {
  await send("Page.navigate", { url: `${base}/robots.txt` });
  await sleep(150);
  await evaluate(
    `(() => { localStorage.clear(); ${Object.entries(storage)
      .map(
        ([k, v]) =>
          `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`,
      )
      .join("")} })()`,
  );
  await send("Page.navigate", { url: `${base}${url}` });
  await waitFor(`document.readyState === "complete"`, `${url} loaded`, 15000);
  await sleep(500);
  // The theme is applied after hydration and colours ease in: wait until
  // they stop changing, or contrast is measured between two themes.
  let last = "";
  for (let i = 0; i < 30; i += 1) {
    const now = await evaluate(
      `[document.body, document.querySelector("header") ?? document.body].map((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).color).join("|") + document.documentElement.className`,
    );
    if (now === last) break;
    last = now;
    await sleep(150);
  }
}

const failures = [];
let scanned = 0;
async function scan(label) {
  if (ONLY && !label.includes(ONLY)) return;
  scanned += 1;
  await evaluate(
    `typeof axe === "undefined" ? (0, eval)(${JSON.stringify(AXE)}) : null; 0`,
  );
  const violations = await evaluate(
    `axe.run(document, { runOnly: { type: "tag", values: ${JSON.stringify(TAGS)} }, resultTypes: ["violations"] }).then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(" "), html: n.html.slice(0, 180), summary: n.failureSummary.split("\\n").slice(1, 3).join(" ").slice(0, 220) })), count: v.nodes.length })))`,
  );
  const real = violations.filter(
    (v) => !(ALLOW[v.id] && new RegExp(ALLOW[v.id].where).test(label)),
  );
  if (real.length === 0) {
    console.log(`✓ ${label}`);
    return;
  }
  console.log(`✗ ${label}`);
  for (const v of real) {
    console.log(`    ${v.id} [${v.impact}] ×${v.count} — ${v.help}`);
    for (const n of v.nodes)
      console.log(`        ${n.target}  ${n.summary}\n          ${n.html}`);
  }
  failures.push({ label, violations: real });
}

/**
 * Tab through a page like a keyboard user (2.1.2, 2.4.7, 2.4.11): every
 * stop must show a focus indicator, must not be entirely hidden behind
 * sticky or fixed UI, and focus must keep moving (no trap).
 */
async function keyboardWalk(label, stops = 45) {
  if (ONLY && !label.includes(ONLY)) return;
  scanned += 1;
  const problems = [];
  let previous = null;
  let stuck = 0;
  await evaluate(`document.activeElement?.blur(); window.scrollTo(0, 0)`);
  for (let i = 0; i < stops; i += 1) {
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await sleep(120);
    const r = await evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const name = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("href") || el.tagName).trim().replace(/\\s+/g, " ").slice(0, 50);
      const css = getComputedStyle(el);
      const indicator = (css.outlineStyle !== "none" && parseFloat(css.outlineWidth) > 0) || (css.boxShadow && css.boxShadow !== "none");
      const box = el.getBoundingClientRect();
      const points = [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]].map(([x, y]) => [box.left + box.width * x, box.top + box.height * y]);
      const onScreen = points.filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
      const visible = onScreen.some(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit && (el === hit || el.contains(hit) || hit.contains(el)); });
      if (!el.dataset.a11yWalk) el.dataset.a11yWalk = String(Math.random()).slice(2);
      const segmented = el.tagName === "INPUT" && /^(date|time|datetime-local|month|week)$/.test(el.type);
      return { key: el.dataset.a11yWalk, name, indicator, visible, segmented, tiny: box.width * box.height === 0 };
    })()`);
    if (!r) continue;
    if (r.key === previous) {
      stuck += 1;
      // Date and time inputs take one Tab per segment (month, day, year).
      if (stuck >= (r.segmented ? 4 : 2)) {
        problems.push(`focus stuck on "${r.name}" (2.1.2)`);
        break;
      }
      continue;
    }
    stuck = 0;
    previous = r.key;
    if (r.tiny) continue; // skip links and other visually-hidden-until-focus targets report 0×0 in some states
    if (!r.indicator)
      problems.push(`no focus indicator on "${r.name}" (2.4.7)`);
    if (!r.visible) problems.push(`"${r.name}" hidden while focused (2.4.11)`);
  }
  const unique = [...new Set(problems)];
  if (unique.length === 0) {
    console.log(`✓ ${label}`);
    return;
  }
  console.log(`✗ ${label}`);
  for (const p of unique.slice(0, 12)) console.log(`    ${p}`);
  failures.push({
    label,
    violations: unique.map((help) => ({ id: "keyboard", help })),
  });
}

function firstChild(dir) {
  const full = path.join(OUT, dir);
  if (!existsSync(full)) return null;
  const child = readdirSync(full).find(
    (name) =>
      statSync(path.join(full, name)).isDirectory() &&
      existsSync(path.join(full, name, "index.html")),
  );
  return child ? `/${dir}/${child}/` : null;
}

try {
  // ── Public pages, both themes ──
  const pages = [
    "/",
    "/about/",
    "/work/",
    "/contact/",
    "/updates/",
    "/blog/",
    "/kit/",
    firstChild("blog"),
    firstChild("work"),
    "/no-such-page/",
  ]
    .filter(Boolean)
    .filter(
      (p) =>
        p === "/no-such-page/" ||
        existsSync(path.join(OUT, p, "index.html")) ||
        existsSync(path.join(OUT, `${p.replace(/\/$/, "")}.html`)),
    );
  // The owner's theme is applied after hydration and wins over the cached
  // `site-theme`, so the dark pass sets the visitor's scheme too: that is
  // what puts a dark theme on a public page. Field Notes is the default pair.
  for (const [theme, scheme] of [
    ["theme-field-notes-light", "light"],
    ["theme-field-notes-dark", "dark"],
  ]) {
    for (const page of pages) {
      await open(page, { "site-theme": theme, "visitor-scheme": scheme });
      await scan(`${page} (${theme.replace("theme-", "")})`);
    }
  }
  // Keyboard: the public pages with the most controls, then a long page scrolled by focus.
  for (const page of ["/", "/work/", "/blog/", "/contact/"]) {
    if (!existsSync(path.join(OUT, page, "index.html"))) continue;
    await open(page, { "site-theme": "theme-ink-light" });
    await keyboardWalk(`keyboard ${page}`);
  }

  // 1.4.10 Reflow: nothing wider than a 320 px window; 3.2.6 Consistent help:
  // the way to reach the owner sits in the footer, at the same place, on every page.
  await send("Emulation.setDeviceMetricsOverride", {
    width: 320,
    height: 700,
    deviceScaleFactor: 1,
    mobile: true,
  });
  const helpOrder = new Map();
  for (const page of pages.filter((p) => p !== "/no-such-page/")) {
    await open(page, { "site-theme": "theme-ink-light" });
    if (ONLY && !`reflow ${page}`.includes(ONLY)) continue;
    scanned += 1;
    const r = await evaluate(`(() => {
      const wide = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== "fixed" && !e.closest("pre, table, [data-scroll-x], .overflow-x-auto")).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 50));
      // The site footer, not an article's own <footer> of tags.
      const footerLinks = [...document.querySelectorAll("footer")].filter((f) => !f.closest("article")).flatMap((f) => [...f.querySelectorAll("a")]).map((a) => a.getAttribute("href"));
      return { overflow: document.documentElement.scrollWidth > innerWidth + 1, wide, contactAt: footerLinks.findIndex((h) => /\\/contact\\/?$/.test(h ?? "")) };
    })()`);
    helpOrder.set(page, r.contactAt);
    const problems = [];
    if (r.overflow)
      problems.push(
        `scrolls sideways at 320 px (1.4.10): ${r.wide.join(" | ")}`,
      );
    if (r.contactAt === -1)
      problems.push("no contact link in the footer (3.2.6)");
    if (problems.length) {
      console.log(`✗ reflow ${page}`);
      for (const p of problems) console.log(`    ${p}`);
      failures.push({
        label: `reflow ${page}`,
        violations: problems.map((help) => ({ id: "reflow", help })),
      });
    } else console.log(`✓ reflow ${page}`);
  }
  if (new Set(helpOrder.values()).size > 1) {
    console.log(
      `✗ the contact link moves around the footer between pages (3.2.6): ${[...helpOrder].map(([p, i]) => `${p} ${i}`).join(", ")}`,
    );
    failures.push({
      label: "consistent help",
      violations: [
        { id: "consistent-help", help: "contact link position differs" },
      ],
    });
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // A phone-width pass of the home page (reflow, target size).
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await open("/", { "site-theme": "theme-ink-light" });
  await scan("/ (phone)");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // ── Money: every area and tab, with a ledger loaded ──
  const areas = [
    "overview",
    "accounts",
    "transactions",
    "plan",
    "investing",
    "borrowing",
    "reports",
    "import",
    "rules",
    "settings",
  ];
  for (const theme of ["theme-ink-light", "theme-ink-dark"]) {
    for (const area of areas) {
      await open(`/dev/money/?area=${area}`, {
        "site-theme": theme,
        "money-harness": MONEY_STATE,
      });
      await waitFor(
        `!document.body.innerText.includes("Loading")`,
        `money ${area}`,
        10000,
      );
      await sleep(300);
      await scan(`money ${area} (${theme.replace("theme-", "")})`);
      const tabs = await evaluate(
        `[...document.querySelectorAll('[role="tablist"] [role="tab"]')].map((t) => t.textContent.trim())`,
      );
      for (const tab of tabs.slice(1)) {
        await evaluate(
          `(() => { const t = [...document.querySelectorAll('[role="tablist"] [role="tab"]')].find((e) => e.textContent.trim() === ${JSON.stringify(tab)}); t.focus(); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); t.click(); })()`,
        );
        await sleep(400);
        await scan(`money ${area} › ${tab} (${theme.replace("theme-", "")})`);
      }
    }
  }
  // Keyboard through the money screens with the most on them.
  for (const area of ["overview", "transactions", "investing"]) {
    await open(`/dev/money/?area=${area}`, {
      "site-theme": "theme-ink-light",
      "money-harness": MONEY_STATE,
    });
    await waitFor(
      `!document.body.innerText.includes("Loading")`,
      `money ${area}`,
      10000,
    );
    await keyboardWalk(`keyboard money ${area}`, 60);
  }

  // A form open: the transaction sheet.
  await open(`/dev/money/?area=overview`, {
    "site-theme": "theme-ink-light",
    "money-harness": MONEY_STATE,
  });
  await waitFor(
    `[...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Transaction")`,
    "transaction button",
  );
  await evaluate(
    `[...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Transaction").click()`,
  );
  await waitFor(`!!document.querySelector('[role="dialog"]')`, "sheet");
  await sleep(500);
  await scan("money transaction sheet (ink-light)");

  // ── Component state matrix: every primitive in every state ──
  if (existsSync(path.join(OUT, "dev", "ui"))) {
    for (const theme of [
      "theme-field-notes-light",
      "theme-field-notes-dark",
      "theme-ink-light",
      "theme-ink-dark",
      "theme-hc-light",
      "theme-hc-dark",
    ]) {
      await open("/dev/ui/", { "site-theme": theme });
      await scan(`component states (${theme.replace("theme-", "")})`);
    }
    await open("/dev/ui/", { "site-theme": "theme-ink-light" });
    await keyboardWalk("keyboard component states");
  }

  // ── Maps ──
  if (existsSync(path.join(OUT, "dev", "maps"))) {
    await open("/dev/maps/", { "site-theme": "theme-ink-light" });
    await sleep(800);
    await scan("maps editor (ink-light)");
  }

  // ── Dashboard: the day, light and dark ──
  if (existsSync(path.join(OUT, "dev", "dashboard"))) {
    for (const theme of ["theme-field-notes-light", "theme-field-notes-dark"]) {
      await open("/dev/dashboard/", { "site-theme": theme });
      await sleep(900);
      await scan(`dashboard (${theme.replace("theme-", "")})`);
    }
  }

  // ── Calendar (rebuilt natively): the views, light and dark ──
  if (existsSync(path.join(OUT, "dev", "calendar"))) {
    for (const [view, theme] of [
      ["week", "theme-field-notes-light"],
      ["week", "theme-field-notes-dark"],
      ["month", "theme-field-notes-light"],
      ["agenda", "theme-field-notes-light"],
    ]) {
      await open("/dev/calendar/", {
        "site-theme": theme,
        "admin-view:calendar": view,
      });
      await sleep(900);
      await scan(`calendar ${view} (${theme.replace("theme-", "")})`);
    }
  }

  // ── Immersive styles: the three layouts and every restyled page in each ──
  if (existsSync(path.join(OUT, "dev", "immersive"))) {
    for (const style of ["noir", "paper", "dusk"]) {
      for (const page of [
        "home",
        "work",
        "case",
        "about",
        "blog",
        "post",
        "updates",
        "contact",
        "kit",
        "cms",
        "admin-dashboard",
        "admin-settings",
      ]) {
        await open(`/dev/immersive/?style=${style}&page=${page}`);
        // A workspace screen has no page wrapper; it takes the style from the document.
        await waitFor(
          page.startsWith("admin-")
            ? `!!document.querySelector("[data-style-root='${style}']") && !!document.querySelector("h1, h2")`
            : `!!document.querySelector("[data-style-scope='${style}'] h1")`,
          `immersive ${page} (${style})`,
        );
        await sleep(600);
        await scan(`immersive ${page} (${style})`);
      }
    }
  }
} catch (error) {
  failures.push({
    label: "script",
    violations: [{ id: "crash", help: error.message }],
  });
  console.log(`✗ script ran to the end (${error.message})`);
}

console.log(
  `\n${scanned - failures.length}/${scanned} screens without WCAG violations`,
);
ws.close();
chrome.kill();
server.close();
process.exit(failures.length ? 1 : 0);
