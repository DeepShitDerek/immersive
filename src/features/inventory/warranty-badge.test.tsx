import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/types";
import { WarrantyBadge } from "./warranty-badge";

const local = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = local(0);
const item = (warranty_expiry: string | null) =>
  ({ id: "i", name: "Kettle", warranty_expiry }) as InventoryItem;
const badge = (expiry: string | null) =>
  render(<WarrantyBadge item={item(expiry)} today={TODAY} />).container
    .firstElementChild!;

describe("WarrantyBadge", () => {
  it("counts the days on a warranty about to end, in the warning colour", () => {
    const el = badge(local(10));
    expect(el.textContent).toBe("10 days left");
    expect(el.className).toContain("text-warning");
    expect(el.querySelector("svg")).toBeTruthy();
  });

  it("treats a lapsed warranty as a quiet fact, not an alarm", () => {
    const el = badge(local(-30));
    expect(el.textContent).toBe("Expired");
    expect(el.className).not.toContain("destructive");
  });

  it("says when there is none, in sentence case", () => {
    expect(badge(null).textContent).toBe("No warranty");
    expect(badge(local(400)).className).toContain("text-success");
  });
});
