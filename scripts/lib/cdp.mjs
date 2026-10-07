import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdtempSync, statSync } from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";

/**
 * A static server over an export directory and a headless Chrome driven over
 * the DevTools protocol, for checks that need to scroll and measure. The same
 * approach as check-a11y.mjs, which predates this helper and keeps its own.
 */
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function serve(out) {
  const server = createServer((req, res) => {
    let file = path.join(
      out,
      decodeURIComponent(new URL(req.url, "http://x").pathname),
    );
    if (existsSync(file) && statSync(file).isDirectory())
      file = path.join(file, "index.html");
    if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    if (!existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/html" });
      return createReadStream(path.join(out, "404.html")).pipe(res);
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream",
    });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return {
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close(),
  };
}

export async function launch() {
  const chromePath = [
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
  if (!chromePath) throw new Error("Chrome not found; set CHROME_PATH.");

  const port = 9500 + (process.pid % 300);
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${mkdtempSync(path.join(os.tmpdir(), "immersive-"))}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let wsUrl;
  for (let i = 0; i < 60 && !wsUrl; i += 1) {
    try {
      wsUrl = (
        await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      ).find((t) => t.type === "page")?.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  if (!wsUrl) throw new Error("Chrome did not start.");

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
    }
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push(
        msg.params.exceptionDetails.exception?.description?.split("\n")[0] ??
          "exception",
      );
    }
    if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    ) {
      errors.push(
        msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "),
      );
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
  await send("Runtime.enable");
  await send("Page.enable");

  return {
    send,
    evaluate,
    sleep,
    /** Console errors and exceptions since the last call. */
    takeErrors: () => errors.splice(0),
    async viewport(width, height, { touch = false } = {}) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: touch,
      });
      await send("Emulation.setTouchEmulationEnabled", { enabled: touch });
    },
    async reducedMotion(on) {
      await send("Emulation.setEmulatedMedia", {
        features: [
          {
            name: "prefers-reduced-motion",
            value: on ? "reduce" : "no-preference",
          },
        ],
      });
    },
    async open(url, ready) {
      await send("Page.navigate", { url });
      const end = Date.now() + 15000;
      while (Date.now() < end) {
        if (
          await evaluate(
            `(() => { try { return document.readyState === "complete" && Boolean(${ready}); } catch { return false; } })()`,
          )
        )
          return;
        await sleep(100);
      }
      throw new Error(`timed out opening ${url}`);
    },
    /** A PNG of the viewport, as a Buffer. */
    async screenshot() {
      const r = await send("Page.captureScreenshot", { format: "png" });
      return Buffer.from(r.result.data, "base64");
    },
    close() {
      ws.close();
      chrome.kill();
    },
  };
}
