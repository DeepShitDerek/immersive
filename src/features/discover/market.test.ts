import { describe, expect, it } from "vitest";
import { formatPercent } from "./market";

describe("formatPercent", () => {
  it("signs a change, so its direction is not colour alone", () => {
    expect(formatPercent(3.24)).toBe("+3.2%");
    expect(formatPercent(-1.05)).toBe("-1.1%");
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("leaves a level unsigned", () => {
    expect(formatPercent(6.1, 1, false)).toBe("6.1%");
  });
});
