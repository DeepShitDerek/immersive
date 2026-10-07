import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
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
 * Browser Definition-of-Done check for the Maps editor.
 *
 * Drives the dev harness (/dev/maps, localStorage-backed) in headless Chrome
 * over the DevTools protocol: create, branch, rename, connect, undo/redo,
 * copy/paste, search, zoom, reload persistence — and fails on any console
 * error or warning.
 *
 * The harness page only exists in a build made with NEXT_PUBLIC_DEV_HARNESS=1:
 *   NEXT_PUBLIC_DEV_HARNESS=1 TZ=UTC npm run build && npm run check:maps
 * OUT overrides the export directory, SHOTS=<dir> saves screenshots,
 * CHROME_PATH overrides the browser.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? path.join(root, "out");
const SHOTS = process.env.SHOTS;
if (!existsSync(path.join(OUT, "dev", "maps"))) {
  console.error(
    `No ${path.join(OUT, "dev", "maps")} — build with NEXT_PUBLIC_DEV_HARNESS=1 first.`,
  );
  process.exit(1);
}
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
  ".json": "application/json",
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
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const port = 9600 + (process.pid % 300);
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "maps-"))}`,
    "--window-size=1440,900",
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
let id = 0;
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
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) =>
  (
    await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
  ).result?.result?.value;

await send("Runtime.enable");
await blockTracking(send);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

const results = [];
const check = (ok, name, detail = "") => {
  results.push({ ok: !!ok, name, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? `  (${detail})` : ""}`);
};

const mouse = async (type, x, y, extra = {}) =>
  send("Input.dispatchMouseEvent", {
    type,
    x,
    y,
    button: "left",
    buttons: type === "mouseReleased" ? 0 : 1,
    clickCount: 1,
    ...extra,
  });
const click = async (x, y, extra = {}) => {
  await mouse("mousePressed", x, y, extra);
  await mouse("mouseReleased", x, y, extra);
  await sleep(120);
};
const dblclick = async (x, y) => {
  await mouse("mousePressed", x, y, { clickCount: 1 });
  await mouse("mouseReleased", x, y, { clickCount: 1 });
  await mouse("mousePressed", x, y, { clickCount: 2 });
  await mouse("mouseReleased", x, y, { clickCount: 2 });
  await sleep(250);
};
const drag = async (from, to, steps = 12, modifiers = 0) => {
  await send("Input.dispatchMouseEvent", {
    type: "mouseMoved",
    x: from.x,
    y: from.y,
    buttons: 0,
  });
  await mouse("mousePressed", from.x, from.y, { modifiers });
  for (let i = 1; i <= steps; i++) {
    await send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x: from.x + ((to.x - from.x) * i) / steps,
      y: from.y + ((to.y - from.y) * i) / steps,
      button: "left",
      buttons: 1,
      modifiers,
    });
    await sleep(16);
  }
  await mouse("mouseReleased", to.x, to.y, { modifiers });
  await sleep(250);
};
const KEYS = {
  Tab: 9,
  Enter: 13,
  Escape: 27,
  Delete: 46,
  Backspace: 8,
  z: 90,
  f: 70,
  a: 65,
};
const key = async (k, modifiers = 0) => {
  const code = KEYS[k];
  const text = k === "Enter" ? "\r" : undefined;
  await send("Input.dispatchKeyEvent", {
    type: "rawKeyDown",
    key: k,
    code: k.length === 1 ? `Key${k.toUpperCase()}` : k,
    windowsVirtualKeyCode: code,
    modifiers,
  });
  if (text)
    await send("Input.dispatchKeyEvent", {
      type: "char",
      text,
      key: k,
      modifiers,
    });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: k,
    code: k.length === 1 ? `Key${k.toUpperCase()}` : k,
    windowsVirtualKeyCode: code,
    modifiers,
  });
  await sleep(180);
};
const type = async (text) => {
  await send("Input.insertText", { text });
  await sleep(120);
};
const CTRL = 2,
  SHIFT = 8;
const shot = async (name) => {
  if (!SHOTS) return;
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(
    path.join(SHOTS, `${name}.png`),
    Buffer.from(r.result.data, "base64"),
  );
};

/** Saved document from local storage (after autosave). */
const saved = async () => {
  await sleep(1100);
  return evaluate(`JSON.parse(localStorage.getItem("maps-harness") || "null")`);
};
const nodeBox = (title) =>
  evaluate(
    `(() => { const el = [...document.querySelectorAll('.react-flow__node')].find(n => n.querySelector('p')?.textContent === ${JSON.stringify(title)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2, left: r.x, top: r.y, w: r.width, h: r.height, id: el.dataset.id }; })()`,
  );
const handle = (title, side) =>
  evaluate(
    `(() => { const el = [...document.querySelectorAll('.react-flow__node')].find(n => n.querySelector('p')?.textContent === ${JSON.stringify(title)}); const h = el?.querySelector('.react-flow__handle[data-handleid="${side}"]'); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`,
  );
const titles = (doc) => (doc?.doc?.nodes ?? []).map((n) => n.title).sort();
const byTitle = (doc, t) => doc.doc.nodes.find((n) => n.title === t);

// 1. Blank map
await send("Page.navigate", { url: `${base}/dev/maps/` });
await sleep(2500);
await evaluate(`localStorage.clear()`);
await send("Page.reload");
await sleep(3000);
check(
  await evaluate(`document.body.innerText.includes("Start with what")`),
  "1. a blank map shows the empty-state hint",
);
await shot("01-blank");

// 2. Double-click empty canvas → node in edit mode → type
await dblclick(640, 360);
check(
  await evaluate(
    `!!document.querySelector('textarea[aria-label="Node title"]')`,
  ),
  "2. double-click adds a node in rename mode",
);
await type("What's happening?");
await key("Enter");
let doc = await saved();
check(
  titles(doc).includes("What's happening?"),
  "2. 'What's happening?' created and autosaved",
);

// 3. Tab → child "Move Out"
await key("Tab");
await type("Move Out");
await key("Enter");
// 4. Tab → "Is it required?" under Move Out
await key("Tab");
await type("Is it required?");
await key("Enter");
// 5. YES (child) then NO (sibling via Enter)
await key("Tab");
await type("YES");
await key("Enter");
await key("Enter");
await type("NO");
await key("Enter");
doc = await saved();
const edgeBetween = (d, a, b) =>
  d.doc.edges.some(
    (e) => e.source === byTitle(d, a)?.id && e.target === byTitle(d, b)?.id,
  );
check(
  edgeBetween(doc, "What's happening?", "Move Out"),
  "3. Tab adds 'Move Out' as a connected child",
);
check(
  edgeBetween(doc, "Move Out", "Is it required?"),
  "4. 'Is it required?' under 'Move Out'",
);
check(
  edgeBetween(doc, "Is it required?", "YES") &&
    edgeBetween(doc, "Is it required?", "NO"),
  "5. YES and NO branch from the question (Enter = sibling)",
);
await shot("02-branches");

// 6. More nodes anywhere (empty spots found, not assumed)
const emptySpot = (y) =>
  evaluate(
    `(() => { for (let x = 1150; x > 200; x -= 40) { const el = document.elementFromPoint(x, ${y}); if (el?.classList.contains('react-flow__pane')) return { x, y: ${y} }; } return null; })()`,
  );
const spot1 = await emptySpot(180);
await dblclick(spot1.x, spot1.y);
await type("Money");
await key("Enter");
const spot2 = await emptySpot(640);
await dblclick(spot2.x, spot2.y);
await type("Rent");
await key("Enter");
await key("Escape");
doc = await saved();
console.log("  nodes now:", JSON.stringify(titles(doc)));
check(
  ["Money", "Rent"].every((t) => titles(doc).includes(t)),
  "6. nodes added anywhere",
);

// 7. Drag a node with the mouse
const before = byTitle(doc, "Rent").position;
const rentBox = await nodeBox("Rent");
await drag(
  { x: rentBox.x, y: rentBox.y },
  { x: rentBox.x - 160, y: rentBox.y + 40 },
);
doc = await saved();
const after = byTitle(doc, "Rent").position;
check(
  Math.abs(after.x - before.x) > 100 && Math.abs(after.y - before.y) > 20,
  "7. dragging moves the node and saves the new position",
  `${Math.round(before.x)},${Math.round(before.y)} → ${Math.round(after.x)},${Math.round(after.y)}`,
);

// 8. Connect Move Out → Money by dragging handle to node
const moveOutHandle = await handle("Move Out", "r");
const moneyBox = await nodeBox("Money");
await drag(moveOutHandle, { x: moneyBox.left + 8, y: moneyBox.y }, 20);
doc = await saved();
check(
  edgeBetween(doc, "Move Out", "Money"),
  "8. drag from a handle connects Move Out → Money",
);

// 9. Connect Money → Rent
const moneyHandle = await handle("Money", "b");
const rentBox2 = await nodeBox("Rent");
await drag(moneyHandle, { x: rentBox2.x, y: rentBox2.top + 6 }, 20);
doc = await saved();
check(edgeBetween(doc, "Money", "Rent"), "9. connect Money → Rent");
await shot("03-connected");

// 10. Break it: click the edge, Delete
const edgeId = doc.doc.edges.find(
  (e) =>
    e.source === byTitle(doc, "Money").id &&
    e.target === byTitle(doc, "Rent").id,
).id;
const edgePoint = await evaluate(
  `(() => { const p = document.querySelector('.react-flow__edge[data-id="${edgeId}"] .react-flow__edge-path'); if (!p) return null; const len = p.getTotalLength(); const pt = p.getPointAtLength(len/2); const m = p.getScreenCTM(); return { x: pt.x * m.a + m.e, y: pt.y * m.d + m.f }; })()`,
);
await click(edgePoint.x, edgePoint.y);
check(
  await evaluate(
    `document.querySelector('.react-flow__edge[data-id="${edgeId}"]')?.classList.contains('selected')`,
  ),
  "10. clicking an edge selects it",
);
await key("Delete");
doc = await saved();
check(
  !doc.doc.edges.some((e) => e.id === edgeId) &&
    titles(doc).includes("Money") &&
    titles(doc).includes("Rent"),
  "10. Delete removes the connection, keeps both nodes",
);

// 11–12. Colour + type via the details panel
const money = await nodeBox("Money");
await click(money.x, money.y);
await evaluate(
  `document.querySelector('[role="radio"][aria-label="Green"]').click()`,
);
await sleep(200);
await evaluate(`document.querySelector('[aria-label="Type"]').click()`);
await sleep(300);
await evaluate(
  `[...document.querySelectorAll('[role="option"]')].find(o => o.textContent.includes('Problem'))?.click()`,
);
await sleep(300);
doc = await saved();
check(byTitle(doc, "Money").color === "green", "11. colour set from the panel");
check(byTitle(doc, "Money").type === "problem", "12. type set from the panel");
check(
  await evaluate(
    `[...document.querySelectorAll('.react-flow__node')].some(n => n.textContent.includes('Problem') && n.textContent.includes('Money'))`,
  ),
  "12. the node shows its type name (not colour alone)",
);

// 13. Edge label
const e2 = doc.doc.edges.find(
  (e) =>
    e.source === byTitle(doc, "Move Out").id &&
    e.target === byTitle(doc, "Money").id,
).id;
const e2pt = await evaluate(
  `(() => { const p = document.querySelector('.react-flow__edge[data-id="${e2}"] .react-flow__edge-path'); const len = p.getTotalLength(); const pt = p.getPointAtLength(len/2); const m = p.getScreenCTM(); return { x: pt.x * m.a + m.e, y: pt.y * m.d + m.f }; })()`,
);
await click(e2pt.x, e2pt.y);
await evaluate(
  `(() => { const i = document.getElementById('map-edge-label'); i.focus(); })()`,
);
await type("because");
doc = await saved();
check(
  doc.doc.edges.find((e) => e.id === e2)?.label === "because",
  "13. edge label edited in the panel",
);
check(
  await evaluate(`document.body.innerText.includes("because")`),
  "13. label is drawn on the canvas",
);
await key("Escape");

// 14–15. Box-select YES and NO, drag them together
const yes = await nodeBox("YES"),
  no = await nodeBox("NO");
await evaluate(`document.activeElement?.blur()`);
await drag(
  { x: Math.min(yes.left, no.left) - 30, y: Math.min(yes.top, no.top) - 30 },
  {
    x: Math.max(yes.left + yes.w, no.left + no.w) + 30,
    y: Math.max(yes.top + yes.h, no.top + no.h) + 30,
  },
  10,
);
const selectedCount = await evaluate(
  `document.querySelectorAll('.react-flow__node.selected').length`,
);
check(
  selectedCount === 2,
  "14. drag-box selects several nodes",
  `${selectedCount} selected`,
);
doc = await saved();
const yb = byTitle(doc, "YES").position,
  nb = byTitle(doc, "NO").position;
const yes2 = await nodeBox("YES");
await drag({ x: yes2.x, y: yes2.y }, { x: yes2.x + 120, y: yes2.y + 90 });
doc = await saved();
const ya = byTitle(doc, "YES").position,
  na = byTitle(doc, "NO").position;
check(
  Math.abs(ya.x - yb.x - (na.x - nb.x)) < 2 && ya.x - yb.x > 60,
  "15. selected nodes move together",
  `ΔYES ${Math.round(ya.x - yb.x)}, ΔNO ${Math.round(na.x - nb.x)}`,
);

// 16. Delete a node
await key("Escape");
const rent = await nodeBox("Rent");
await click(rent.x, rent.y);
await key("Delete");
doc = await saved();
check(!titles(doc).includes("Rent"), "16. Delete removes the selected node");

// 17. Undo / redo
await evaluate(`document.activeElement?.blur()`);
await key("z", CTRL);
doc = await saved();
check(titles(doc).includes("Rent"), "17. Ctrl+Z brings the node back");
await key("z", CTRL | SHIFT);
doc = await saved();
check(!titles(doc).includes("Rent"), "17. Ctrl+Shift+Z deletes it again");
const beforeUndoAll = titles(await saved());
for (let i = 0; i < 60; i++) await key("z", CTRL);
doc = await saved();
check(
  titles(doc).length === 0,
  "17. undo all the way back to an empty map",
  `${titles(doc).length} left`,
);
for (let i = 0; i < 60; i++) await key("z", CTRL | SHIFT);
doc = await saved();
check(
  JSON.stringify(titles(doc)) === JSON.stringify(beforeUndoAll),
  "17. redo all the way forward restores the same map",
  `${titles(doc).length} nodes`,
);

// 18. Search
await key("f", CTRL);
check(
  await evaluate(`!!document.querySelector('[cmdk-input]')`),
  "18. Ctrl+F opens search",
);
await type("req");
await sleep(300);
const results18 = await evaluate(
  `[...document.querySelectorAll('[cmdk-item]')].map(i => i.textContent)`,
);
check(
  results18?.[0]?.includes("Is it required?"),
  "18. search finds 'Is it required?'",
  JSON.stringify(results18?.slice(0, 2)),
);
await key("Enter");
await sleep(500);
check(
  (await evaluate(
    `document.querySelector('.react-flow__node.selected p')?.textContent`,
  )) === "Is it required?",
  "18. choosing a result selects that node",
);

// 19. Zoom / pan
const t0 = await evaluate(
  `document.querySelector('.react-flow__viewport').style.transform`,
);
await send("Input.dispatchMouseEvent", {
  type: "mouseWheel",
  x: 700,
  y: 400,
  deltaX: 0,
  deltaY: 300,
});
await sleep(400);
const t1 = await evaluate(
  `document.querySelector('.react-flow__viewport').style.transform`,
);
check(t0 !== t1, "19. scrolling pans the canvas");
await send("Input.dispatchMouseEvent", {
  type: "mouseWheel",
  x: 700,
  y: 400,
  deltaX: 0,
  deltaY: -300,
  modifiers: CTRL,
});
await sleep(400);
const t2 = await evaluate(
  `document.querySelector('.react-flow__viewport').style.transform`,
);
check(/scale\((?!1\))/.test(t2) && t2 !== t1, "19. Ctrl+scroll zooms", t2);
await shot("04-final");

// 20. Reload keeps everything
await sleep(1200);
const beforeReload = titles(await saved());
await send("Page.reload");
await sleep(3000);
const rendered = await evaluate(
  `[...document.querySelectorAll('.react-flow__node p')].map(p => p.textContent).sort()`,
);
check(
  JSON.stringify(rendered) === JSON.stringify(beforeReload),
  "20. reopening restores the map",
  `${rendered?.length} nodes`,
);

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
console.log(
  errors.length
    ? `console problems:\n  ${[...new Set(errors)].join("\n  ")}`
    : "no console errors or warnings",
);
ws.close();
chrome.kill();
server.close();
process.exit(failed ? 1 : 0);
