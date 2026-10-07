import { describe, expect, it } from "vitest";
import { healthRows } from "./security-health";

const now = new Date("2026-10-05T12:00:00Z");
const ok = { loading: false, failed: false };
const rows = (over: Partial<Parameters<typeof healthRows>[0]> = {}) =>
  healthRows({
    factors: { ...ok, verified: 2 },
    site: { ...ok, level: 0 },
    lastBackup: "2026-10-04T09:00:00Z",
    now,
    ...over,
  });
const row = (id: string, over?: Partial<Parameters<typeof healthRows>[0]>) =>
  rows(over).find((r) => r.id === id)!;

describe("security health summary", () => {
  it("is all good with two methods, a recent backup and an open site", () => {
    expect(rows().map((r) => r.tone)).toEqual(["good", "good", "good"]);
    expect(row("backup").text).toBe(
      "Last downloaded yesterday, in this browser",
    );
  });

  it("asks for a second method when there is only one, and flags none", () => {
    expect(row("2fa", { factors: { ...ok, verified: 1 } }).tone).toBe("warn");
    expect(row("2fa", { factors: { ...ok, verified: 0 } }).tone).toBe("bad");
  });

  it("never reads a failed lookup as the safe answer", () => {
    const site = row("site", {
      site: { loading: false, failed: true, level: 0 },
    });
    expect(site.tone).toBe("unknown");
    expect(site.text).not.toMatch(/open/i);
    expect(
      row("2fa", { factors: { loading: false, failed: true, verified: 0 } })
        .tone,
    ).toBe("unknown");
  });

  it("names a lockdown and maintenance in words", () => {
    expect(row("site", { site: { ...ok, level: 1 } })).toMatchObject({
      tone: "warn",
      text: "Maintenance",
    });
    expect(row("site", { site: { ...ok, level: 2 } })).toMatchObject({
      tone: "bad",
      text: "Locked down",
    });
  });

  it("nudges when there is no backup, or an old one", () => {
    expect(row("backup", { lastBackup: null })).toMatchObject({
      tone: "warn",
      text: "None downloaded in this browser",
    });
    expect(row("backup", { lastBackup: "2026-08-01T00:00:00Z" }).tone).toBe(
      "warn",
    );
    expect(row("backup", { lastBackup: "garbage" }).tone).toBe("warn");
  });
});
