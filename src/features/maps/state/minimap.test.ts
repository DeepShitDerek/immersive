import { describe, expect, it } from "vitest";
import { MINIMAP_MIN_NODES, minimapVisible } from "./minimap";

describe("minimapVisible", () => {
  it("waits until the map is big enough", () => {
    expect(
      minimapVisible({
        enabled: true,
        nodeCount: MINIMAP_MIN_NODES,
        isMobile: false,
      }),
    ).toBe(false);
    expect(
      minimapVisible({
        enabled: true,
        nodeCount: MINIMAP_MIN_NODES + 1,
        isMobile: false,
      }),
    ).toBe(true);
  });
  it("never shows on a phone, or when turned off", () => {
    expect(
      minimapVisible({ enabled: true, nodeCount: 50, isMobile: true }),
    ).toBe(false);
    expect(
      minimapVisible({ enabled: false, nodeCount: 50, isMobile: false }),
    ).toBe(false);
  });
});
