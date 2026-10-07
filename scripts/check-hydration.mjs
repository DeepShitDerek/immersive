import { spawn } from "node:child_process";
import {
  createReadStream,
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
} from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockTracking } from "./lib/no-tracking.mjs";
import { stripBasePath } from "./lib/base-path.mjs";

/**
 * Hydration check for the prerendered public pages.
 *
 * Serves out/ locally, opens each page in headless Chrome over the DevTools
 * protocol, and fails on any React hydration error (#418/#423/#425) or
 * uncaught exception. Each page is checked with the browser pretending to be
 * in several timezones, because the build runs in UTC and a date formatted in
 * the visitor's zone is the classic way a prerendered page and its first
 * client render disagree.
 *
 * Run after `next build`: `npm run check:hydration`.
 * Chrome is found automatically; override with CHROME_PATH.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out");
const PAGES = [
  "/",
  "/about/",
  "/contact/",
  "/work/",
  "/updates/",
  "/blog/",
  "/blog/?tag=RAG",
];
const TIMEZONES = [
  "Pacific/Kiritimati",
  "America/Toronto",
  "Pacific/Pago_Pago",
];
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 4000);
const HYDRATION = /hydrat|did not match|#418|#423|#425/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** A static server for out/ that resolves /path/ to /path/index.html. */
function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let file = path.join(out, decodeURIComponent(stripBasePath(url.pathname)));
    if (!file.startsWith(out)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}

async function devtoolsPage(port) {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${port}/json/list`)
      ).json();
      const page = list.find((target) => target.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // Chrome not listening yet.
    }
    await sleep(200);
  }
  throw new Error("Chrome did not expose a page target");
}

if (!existsSync(out)) {
  console.error("✗ out/ not found — run `next build` first");
  process.exit(1);
}
const chromePath = findChrome();
if (!chromePath) {
  console.error("✗ Chrome not found — set CHROME_PATH");
  process.exit(1);
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
const debugPort = 9300 + (process.pid % 500);
const profile = mkdtempSync(path.join(os.tmpdir(), "hydration-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let failures = 0;
try {
  const ws = new WebSocket(await devtoolsPage(debugPort));
  await new Promise((resolve) =>
    ws.addEventListener("open", resolve, { once: true }),
  );

  let nextId = 0;
  const pending = new Map();
  let events = [];
  ws.addEventListener("message", (message) => {
    const msg = JSON.parse(message.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const details = msg.params.exceptionDetails;
      events.push(
        `exception: ${details.exception?.description ?? details.text}`,
      );
    } else if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    ) {
      const text = msg.params.args
        .map((a) => a.value ?? a.description ?? "")
        .join(" ");
      events.push(`console.error: ${text}`);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++nextId;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Runtime.enable");
  // A build with Supabase settings talks to the live project. This check reads
  // like a visitor but must not count as one: block the analytics beacon and
  // the blog view counter, the only public writes a page makes on its own.
  await blockTracking(send);
  await send("Network.setBlockedURLs", {
    urls: ["*/rest/v1/site_visits*", "*/rest/v1/rpc/increment_blog_post_view*"],
  });

  for (const timezoneId of TIMEZONES) {
    await send("Emulation.setTimezoneOverride", { timezoneId });
    for (const page of PAGES) {
      events = [];
      await send("Page.navigate", { url: base + page });
      await sleep(SETTLE_MS);
      const hydration = events.filter((event) => HYDRATION.test(event));
      const other = events.filter((event) => !HYDRATION.test(event));
      if (hydration.length > 0) {
        failures += 1;
        console.log(
          `✗ ${page} (${timezoneId}): ${hydration.length} hydration error(s)`,
        );
        for (const event of hydration.slice(0, 2))
          console.log(`    ${event.split("\n")[0]}`);
      } else {
        console.log(`✓ ${page} (${timezoneId})`);
      }
      for (const event of other)
        console.log(`    note: ${event.split("\n")[0].slice(0, 160)}`);
    }
  }
  ws.close();
} catch (error) {
  console.error(`✗ ${error instanceof Error ? error.message : error}`);
  failures += 1;
} finally {
  chrome.kill();
  server.close();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome may still hold the profile briefly on Windows; it is a temp dir.
  }
}

console.log(
  failures === 0
    ? `\nAll ${PAGES.length} pages hydrate cleanly in ${TIMEZONES.length} timezones`
    : `\n${failures} page/timezone combination(s) failed to hydrate`,
);
process.exit(failures === 0 ? 0 : 1);
