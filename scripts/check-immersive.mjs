import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, serve } from "./lib/cdp.mjs";

/**
 * Scrolls through every immersive layout in every style, at a desktop and a
 * phone width, and once with reduced motion, and checks at each stop:
 *   - the section in view has readable text (present, not transparent);
 *   - the page does not scroll sideways;
 *   - the console is clean.
 * Reduced motion and the phone (upright and on its side) additionally check
 * that nothing is pinned; where panels are pinned, that none clips its own
 * content. Last, a Classic build must not ship the immersive code.
 *
 * Needs a harness build:
 *   NEXT_PUBLIC_DEV_HARNESS=1 TZ=UTC npm run build && npm run check:immersive
 * OUT overrides the export directory, CHROME_PATH the browser.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT ?? path.join(root, "out");
if (!existsSync(path.join(OUT, "dev", "immersive"))) {
  console.error(
    `No ${path.join(OUT, "dev", "immersive")}. Build with NEXT_PUBLIC_DEV_HARNESS=1 first.`,
  );
  process.exit(1);
}

const STYLES = ["noir", "paper", "dusk"];
const PAGES = [
  {
    page: "home",
    marker: "[data-beat]",
    expect: [
      "opening",
      "statement",
      "proof",
      "work",
      "now",
      "writing",
      "closing",
    ],
  },
  {
    page: "home",
    content: "bare",
    marker: "[data-beat]",
    expect: ["opening", "closing"],
  },
  {
    page: "home",
    content: "long",
    marker: "[data-beat]",
    expect: [
      "opening",
      "statement",
      "proof",
      "work",
      "now",
      "writing",
      "closing",
    ],
  },
  { page: "work", marker: "[data-row]", min: 4 },
  {
    page: "case",
    marker: "[data-part]",
    expect: ["title", "reading", "handoff"],
  },
  // The pages that keep their own components and only take the style.
  // The pages with their own immersive layouts. None of them pins anything.
  { page: "blog", marker: "[data-row]", min: 3, noPins: true },
  {
    page: "post",
    marker: "[data-part]",
    expect: ["title", "reading", "handoff"],
    noPins: true,
  },
  { page: "updates", marker: "[data-row]", min: 4, noPins: true },
  {
    page: "about",
    marker: "[data-part]",
    expect: ["opening", "lead", "bio"],
    noPins: true,
  },
  {
    page: "contact",
    marker: "[data-part]",
    expect: ["opening", "ways"],
    noPins: true,
  },
  // The same pages with almost nothing, and with content at the long end.
  // Two view sizes are enough for these: they test content, not layout modes.
  ...["blog", "post", "updates", "about", "contact"].flatMap((page) =>
    ["bare", "long"].map((content) => ({
      page,
      content,
      marker: "main h1",
      min: 1,
      noPins: true,
      views: ["1440", "390"],
    })),
  ),
  // The pages that keep their own components and only take the style.
  ...["kit", "cms"].map((page) => ({ page, marker: "main h1", min: 1 })),
];
const VIEWS = [
  {
    name: "1440",
    width: 1440,
    height: 900,
    touch: false,
    reduced: false,
    pinned: true,
  },
  {
    name: "390",
    width: 390,
    height: 844,
    touch: true,
    reduced: false,
    pinned: false,
  },
  // A phone on its side is wide enough for the desktop layout and far too
  // short for a pinned full-screen panel.
  {
    name: "844x390",
    width: 844,
    height: 390,
    touch: true,
    reduced: false,
    pinned: false,
  },
  {
    name: "1366x768",
    width: 1366,
    height: 768,
    touch: false,
    reduced: false,
    pinned: true,
  },
  {
    name: "1440 reduced",
    width: 1440,
    height: 900,
    touch: false,
    reduced: true,
    pinned: false,
  },
];

const { base, close: closeServer } = await serve(OUT);
const browser = await launch();
const failures = [];
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ""}`);
  console.log(
    `${ok ? "✓" : "✗"} ${label}${ok || !detail ? "" : ` (${detail})`}`,
  );
};

/** In the page: is the element's own text there and not see-through? */
const READABLE = `(el) => {
  const text = el.innerText.trim();
  if (!text) return "no text";
  let node = el;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (style.visibility === "hidden" || style.display === "none") return "hidden";
    if (Number(style.opacity) < 0.25) return "opacity " + style.opacity;
    node = node.parentElement;
  }
  return "";
}`;

try {
  for (const view of VIEWS) {
    await browser.viewport(view.width, view.height, { touch: view.touch });
    await browser.reducedMotion(view.reduced);
    for (const style of STYLES) {
      for (const spec of PAGES) {
        if (spec.views && !spec.views.includes(view.name)) continue;
        const label = `${style} ${spec.page}${spec.content ? ` (${spec.content})` : ""} @ ${view.name}`;
        const query = `style=${style}&page=${spec.page}${spec.content ? `&content=${spec.content}` : ""}`;
        browser.takeErrors();
        await browser.open(
          `${base}/dev/immersive/?${query}`,
          `document.querySelector(${JSON.stringify(spec.marker)})`,
        );
        // Let the motion libraries load (they wait two frames) and settle.
        await browser.sleep(900);

        const names = await browser.evaluate(
          `[...document.querySelectorAll(${JSON.stringify(spec.marker)})].map((el) => el.dataset.beat ?? el.dataset.part ?? "row")`,
        );
        if (spec.expect)
          check(
            `${label}: sections`,
            JSON.stringify(names) === JSON.stringify(spec.expect),
            names.join(","),
          );
        if (spec.min)
          check(
            `${label}: rows`,
            names.length >= spec.min,
            String(names.length),
          );

        // Walk the page half a screen at a time; at each stop, every marked
        // section that fills the viewport must be readable.
        const height = await browser.evaluate(
          "document.documentElement.scrollHeight",
        );
        const problems = [];
        for (let y = 0; y < height; y += Math.round(view.height * 0.5)) {
          await browser.evaluate(`window.scrollTo(0, ${y})`);
          await browser.sleep(120);
          const found = await browser.evaluate(`(() => {
            const readable = ${READABLE};
            const out = [];
            for (const el of document.querySelectorAll(${JSON.stringify(spec.marker)})) {
              const box = el.getBoundingClientRect();
              const visible = Math.min(box.bottom, innerHeight) - Math.max(box.top, 0);
              if (visible < innerHeight * 0.5 && visible < box.height * 0.9) continue;
              const why = readable(el);
              if (why) out.push((el.dataset.beat ?? el.dataset.part ?? "row") + " " + why);
            }
            if (document.documentElement.scrollWidth > innerWidth + 1) out.push("scrolls sideways by " + (document.documentElement.scrollWidth - innerWidth));
            return out;
          })()`);
          for (const problem of found) problems.push(`y=${y} ${problem}`);
        }
        check(
          `${label}: readable at every stop`,
          problems.length === 0,
          problems.slice(0, 3).join("; "),
        );

        const pinned = await browser.evaluate(
          `[...document.querySelectorAll(".im-pin")].filter((el) => getComputedStyle(el).position === "sticky").length`,
        );
        const pinnable = await browser.evaluate(
          `document.querySelectorAll(".im-pin").length`,
        );
        if (pinnable > 0) {
          check(
            `${label}: ${view.pinned ? "pins" : "nothing pinned"}`,
            view.pinned ? pinned === pinnable : pinned === 0,
            `${pinned}/${pinnable}`,
          );
        }
        if (spec.noPins)
          check(
            `${label}: nothing on this page can pin`,
            pinnable === 0,
            String(pinnable),
          );
        if (view.pinned && pinnable > 0) {
          // A pinned box is at most a screen tall. Content that does not fit a
          // clipped panel is lost: the next panel covers it before it shows.
          const clipped = await browser.evaluate(
            `[...document.querySelectorAll(".im-pin")].filter((el) => getComputedStyle(el).overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1).map((el) => el.scrollHeight + ">" + el.clientHeight)`,
          );
          check(
            `${label}: no pinned panel clips its content`,
            clipped.length === 0,
            clipped.join(", "),
          );
          // A pinned box that grows past the screen must not run into the next
          // section: its own section has to be tall enough to hold it.
          const spill = await browser.evaluate(
            `[...document.querySelectorAll(".im-pin")].filter((el) => el.scrollHeight > el.offsetHeight + 1 || (el.parentElement.classList.contains("im-pin-track") && el.offsetHeight > el.parentElement.offsetHeight)).length`,
          );
          check(
            `${label}: no pinned box spills out of its section`,
            spill === 0,
            String(spill),
          );
        }
        if (view.reduced) {
          const moved = await browser.evaluate(
            `[...document.querySelectorAll("[data-beat] *, [data-part] *")].filter((el) => el.style.transform || el.style.opacity).length`,
          );
          check(
            `${label}: no script-driven motion`,
            moved === 0,
            String(moved),
          );
        }

        const errors = browser.takeErrors();
        check(`${label}: console clean`, errors.length === 0, errors[0] ?? "");
      }
    }
  }

  // Keyboard: every link in the pinned work beat is reachable in document
  // order, and a focused link is not left under a later panel or the header.
  await browser.viewport(1440, 900);
  await browser.reducedMotion(false);
  await browser.open(
    `${base}/dev/immersive/?style=noir&page=home`,
    `document.querySelector('[data-beat="work"]')`,
  );
  await browser.sleep(900);
  // A real key press first: Chrome only treats a script's focus() as keyboard
  // focus (:focus-visible) once the keyboard has been used on the page.
  for (const type of ["keyDown", "keyUp"]) {
    await browser.send("Input.dispatchKeyEvent", {
      type,
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
  }
  const order = await browser.evaluate(`(async () => {
    const links = [...document.querySelectorAll('[data-beat="work"] a')];
    const seen = [];
    for (const link of links) {
      link.focus();
      await new Promise((r) => setTimeout(r, 400));
      const box = link.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      seen.push(document.activeElement === link && (top === link || link.contains(top)));
    }
    return seen;
  })()`);
  check(
    "noir home @ 1440: focused work links are on top",
    order.length > 0 && order.every(Boolean),
    JSON.stringify(order),
  );

  // Hash links still work with smooth scrolling on.
  await browser.evaluate(`location.hash = "im-writing-heading"`);
  await browser.sleep(3000);
  const landedAt = await browser.evaluate(
    `Math.round(document.getElementById("im-writing-heading").getBoundingClientRect().top)`,
  );
  check(
    "noir home @ 1440: a hash link lands on its target",
    landedAt >= 0 && landedAt < 900,
    `top ${landedAt}`,
  );

  // The whole document is in the style, not just the page wrapper: toasts,
  // menus and tooltips are drawn under <body> and inherit from <html>.
  await browser.viewport(1440, 900);
  for (const style of STYLES) {
    await browser.open(
      `${base}/dev/immersive/?style=${style}&page=contact`,
      `document.querySelector("[data-style-root]")`,
    );
    await browser.sleep(600);
    const doc = await browser.evaluate(`(() => {
      const root = document.querySelector("[data-style-root]");
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;background:hsl(var(--popover));color:hsl(var(--popover-foreground));font-family:var(--font-body)";
      document.body.appendChild(probe);
      const page = document.createElement("div");
      page.style.cssText = probe.style.cssText;
      root.appendChild(page);
      const read = (el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color, getComputedStyle(el).fontFamily].join(" | ");
      const out = { under: read(probe), inside: read(page), bodyBg: getComputedStyle(document.body).backgroundColor, rootBg: getComputedStyle(root).backgroundColor };
      probe.remove(); page.remove();
      return out;
    })()`);
    check(
      `${style}: what is drawn under <body> is styled like the page`,
      doc.under === doc.inside,
      `${doc.under} vs ${doc.inside}`,
    );
    check(
      `${style}: the document's ground is the style's`,
      doc.bodyBg === doc.rootBg,
      `${doc.bodyBg} vs ${doc.rootBg}`,
    );
  }

  // The workspace follows the saved style too: its ground and text are the
  // style's, not the theme's.
  const GROUND = {
    noir: "rgb(11, 11, 12)",
    paper: "rgb(244, 240, 230)",
    dusk: "rgb(7, 7, 26)",
  };
  for (const style of STYLES) {
    browser.takeErrors();
    await browser.open(
      `${base}/dev/immersive/?style=${style}&page=admin-dashboard`,
      `document.querySelector("[data-style-root]") && document.querySelector("h1, h2")`,
    );
    await browser.sleep(900);
    const admin = await browser.evaluate(`(() => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;background:hsl(var(--background));color:hsl(var(--foreground));font-family:var(--font-body)";
      document.body.appendChild(probe);
      const out = { bg: getComputedStyle(probe).backgroundColor, font: getComputedStyle(probe).fontFamily, dark: document.documentElement.classList.contains("dark"), texture: !!document.querySelector(".im-texture"), sideways: document.documentElement.scrollWidth - innerWidth };
      probe.remove();
      return out;
    })()`);
    check(
      `${style} workspace: the ground is the style's`,
      admin.bg === GROUND[style],
      admin.bg,
    );
    check(
      `${style} workspace: the text face is the style's`,
      /Inter Tight/.test(admin.font),
      admin.font.slice(0, 60),
    );
    check(
      `${style} workspace: dark mode matches the style's ground`,
      admin.dark === (style !== "paper"),
      String(admin.dark),
    );
    check(
      `${style} workspace: no page texture over the workspace`,
      admin.texture === false,
    );
    check(
      `${style} workspace: console clean`,
      browser.takeErrors().length === 0,
    );
  }

  // An unsaved style being previewed in Settings restyles the preview only.
  if (existsSync(path.join(OUT, "dev", "settings"))) {
    await browser.open(
      `${base}/dev/settings/`,
      `document.querySelector("h1, h2")`,
    );
    await browser.sleep(1200);
    await browser.evaluate(
      `[...document.querySelectorAll("button, a")].find((el) => el.textContent.trim().startsWith("Site style"))?.click()`,
    );
    await browser.sleep(600);
    const before = await browser.evaluate(
      `getComputedStyle(document.documentElement).getPropertyValue("--background").trim() + "|" + getComputedStyle(document.body).backgroundColor`,
    );
    await browser.evaluate(
      `document.querySelector('input[type=radio][value="noir"]')?.click()`,
    );
    await browser.sleep(900);
    const after = await browser.evaluate(
      `getComputedStyle(document.documentElement).getPropertyValue("--background").trim() + "|" + getComputedStyle(document.body).backgroundColor`,
    );
    const frame = await browser.evaluate(
      `document.querySelector('[data-testid="preview-frame"]')?.dataset.styleScope ?? "none"`,
    );
    check(
      "settings: choosing Noir restyles the preview frame",
      frame === "noir",
      frame,
    );
    check(
      "settings: and the workspace waits for the save",
      before === after,
      `${before} -> ${after}`,
    );
    // Theme is then for the workspace only, and says so.
    await browser.evaluate(
      `[...document.querySelectorAll("button, a")].find((el) => el.textContent.trim().startsWith("Theme"))?.click()`,
    );
    await browser.sleep(700);
    const note = await browser.evaluate(
      `document.querySelector('[role="note"]')?.innerText ?? ""`,
    );
    check(
      "settings: Theme says it has no effect under the style",
      /Noir/.test(note) && /no effect/i.test(note),
      note.slice(0, 80),
    );
    check(
      "settings: and offers no public-site preview",
      (await browser.evaluate(
        `!document.querySelector('[data-testid="preview-frame"]')`,
      )) === true,
    );
  }

  // A Classic page must not ship the immersive code: no page's scripts may
  // carry the style tokens, the shell or the motion libraries.
  for (const page of ["index.html", "work/index.html", "about/index.html"]) {
    const html = readFileSync(path.join(OUT, page), "utf8");
    if (!html.includes('data-style="classic"')) {
      console.log(
        `- ${page}: built in an immersive style; bundle check skipped`,
      );
      continue;
    }
    const scripts = [
      ...html.matchAll(/<script[^>]+src="(\/_next\/[^"]+\.js)"/g),
    ].map((m) => m[1]);
    const carrying = scripts.filter((src) => {
      const code = readFileSync(
        path.join(OUT, decodeURIComponent(src)),
        "utf8",
      );
      return ["--im-display-leading", "im-texture", "ScrollTrigger"].some(
        (mark) => code.includes(mark),
      );
    });
    check(
      `classic /${page}: no immersive code in its ${scripts.length} scripts`,
      scripts.length > 0 && carrying.length === 0,
      carrying.join(", "),
    );
  }
} catch (error) {
  failures.push(`script: ${error.message}`);
  console.log(`✗ script ran to the end (${error.message})`);
} finally {
  browser.close();
  closeServer();
}

console.log(`\n${checks - failures.length}/${checks} checks passed`);
process.exit(failures.length === 0 ? 0 : 1);
