import { execFileSync } from "node:child_process";

/**
 * Production dependency audit gate.
 *
 * `npm audit` alone would fail every build on advisories that are already
 * known, understood and waiting on a major upgrade, and a gate that always
 * fails gets ignored. So: every advisory in a runtime dependency must be in
 * KNOWN below with the reason it is tolerated and the item that removes it.
 * Anything new fails the build; a KNOWN entry that no longer appears fails
 * too, so the list cannot rot.
 *
 *   node scripts/check-audit.mjs
 */

const KNOWN = {
  nanoid: {
    why: "Via @excalidraw/excalidraw, admin-only whiteboards; ids are not security tokens.",
    until: "Excalidraw major upgrade",
  },
  "@excalidraw/excalidraw": {
    why: "Carries nanoid and mermaid-to-excalidraw below; admin only.",
    until: "Excalidraw major upgrade",
  },
  "@excalidraw/mermaid-to-excalidraw": {
    why: "Via @excalidraw/excalidraw; admin only.",
    until: "Excalidraw major upgrade",
  },
  "@mermaid-js/parser": {
    why: "Via mermaid-to-excalidraw; parses the owner's own diagrams.",
    until: "Excalidraw major upgrade",
  },
  langium: {
    why: "Via @mermaid-js/parser.",
    until: "Excalidraw major upgrade",
  },
  chevrotain: { why: "Via langium.", until: "Excalidraw major upgrade" },
  "@chevrotain/cst-dts-gen": {
    why: "Via chevrotain.",
    until: "Excalidraw major upgrade",
  },
  "@chevrotain/gast": {
    why: "Via chevrotain.",
    until: "Excalidraw major upgrade",
  },
  mermaid: {
    why: "Via mermaid-to-excalidraw, admin-only whiteboards; carries katex below. Renders the owner's own diagrams.",
    until: "Excalidraw major upgrade",
  },
  katex: {
    why: "Via mermaid (GHSA-238p-pmpm-9mq7, fixed in 0.18.2; mermaid pins 0.16). Needs an existing prototype pollution to matter, and only ever typesets the owner's own diagram text.",
    until: "Excalidraw major upgrade",
  },
  sass: {
    why: "A dependency of the @excalidraw/excalidraw package itself, never run: the site ships Excalidraw's compiled CSS. Carries chokidar below.",
    until: "Excalidraw major upgrade",
  },
  chokidar: {
    why: "Reported through @excalidraw/excalidraw > sass, which is never run (see sass above). Carries braces below.",
    until: "A braces release that fixes GHSA-vfj7-8cjw-p6xm",
  },
  braces: {
    why: "GHSA-vfj7-8cjw-p6xm (stack exhaustion on deeply nested patterns) has no fixed release. Reported through @excalidraw/excalidraw > sass > chokidar, which is never run. Elsewhere it only expands the project's own glob patterns in development tools; no visitor or network input reaches it, and nothing of it ships in the static site.",
    until: "A braces release that fixes GHSA-vfj7-8cjw-p6xm",
  },
  "lodash-es": {
    why: "Via chevrotain; `_.template` is never given untrusted input (the parser uses its own data only).",
    until: "Excalidraw major upgrade",
  },
};

let report;
try {
  report = execFileSync("npm", ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  // npm audit exits non-zero when it finds anything; the JSON is still on stdout.
  report = error.stdout;
}
let parsed;
try {
  parsed = JSON.parse(report);
} catch {
  console.error("npm audit did not return JSON (offline?)");
  process.exit(1);
}

const found = parsed.vulnerabilities ?? {};
let failed = false;
for (const [name, v] of Object.entries(found)) {
  if (KNOWN[name]) {
    console.log(
      `· ${v.severity.padEnd(8)} ${name} — known: ${KNOWN[name].until}`,
    );
  } else {
    failed = true;
    const titles = v.via
      .map((x) => (typeof x === "string" ? `via ${x}` : x.title))
      .join("; ");
    console.log(`✗ ${v.severity.padEnd(8)} ${name} — NEW: ${titles}`);
  }
}
for (const name of Object.keys(KNOWN)) {
  if (!found[name]) {
    failed = true;
    console.log(
      `✗ ${name} is listed as known but no longer reported — remove it from KNOWN`,
    );
  }
}
console.log(
  failed
    ? "\nAudit gate failed."
    : `\nNo new advisories (${Object.keys(found).length} known).`,
);
process.exit(failed ? 1 : 0);
