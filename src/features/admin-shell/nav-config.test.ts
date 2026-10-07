import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV_GROUPS, NAV_ITEMS } from "./nav-config";

const routes = resolve(__dirname, "../../app/admin/(protected)");

describe("workspace navigation", () => {
  it("lists each module once", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("points every entry at a real route", () => {
    for (const { href } of NAV_ITEMS) {
      const segment = href.replace(/^\/admin\/?/, "");
      expect(existsSync(resolve(routes, segment, "page.tsx")), href).toBe(true);
    }
  });

  it("has no empty or oversized group", () => {
    // More than five in one group and the eye stops grouping.
    for (const group of NAV_GROUPS) {
      expect(group.items.length, group.label).toBeGreaterThan(0);
      expect(group.items.length, group.label).toBeLessThanOrEqual(5);
    }
  });
});
