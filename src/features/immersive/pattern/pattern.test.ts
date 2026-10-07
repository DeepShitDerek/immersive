import { describe, expect, it } from "vitest";
import { projectPattern } from "./pattern";

const numbers = (path: string) =>
  (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("projectPattern", () => {
  it("gives the same project the same pattern", () => {
    expect(projectPattern("Ledger", ["go", "postgres"])).toEqual(
      projectPattern("Ledger", ["go", "postgres"]),
    );
  });

  it("does not depend on tag order or case", () => {
    expect(projectPattern("Ledger", ["Go", "Postgres"])).toEqual(
      projectPattern("Ledger", ["postgres", "go"]),
    );
  });

  it("gives different projects different patterns", () => {
    const a = JSON.stringify(projectPattern("Ledger", ["go"]));
    const b = JSON.stringify(projectPattern("Atlas", ["go"]));
    const c = JSON.stringify(projectPattern("Ledger", ["rust"]));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it.each([
    ["an empty title", "", []],
    ["no tags", "Ledger", undefined],
    ["a very long title", "x".repeat(400), ["a"]],
    ["non-latin text", "台帳 · رصيد · 🧾", ["日本"]],
  ])("handles %s", (_label, title, tags) => {
    const pattern = projectPattern(
      title as string,
      tags as string[] | undefined,
    );
    expect(pattern.paths.length).toBeGreaterThanOrEqual(6);
    expect(pattern.paths.length).toBeLessThanOrEqual(40);
    for (const path of pattern.paths) {
      expect(path.startsWith("M")).toBe(true);
      for (const n of numbers(path)) expect(Number.isFinite(n)).toBe(true);
    }
  });

  it("covers every kind across a spread of titles", () => {
    const kinds = new Set(
      Array.from({ length: 60 }, (_, i) => projectPattern(`Project ${i}`).kind),
    );
    expect([...kinds].sort()).toEqual(["grid", "rays", "rings", "waves"]);
  });
});
