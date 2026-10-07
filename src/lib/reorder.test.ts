import { describe, expect, it } from "vitest";
import { moveBy, moveWithin } from "./reorder";

const order = ["a", "b", "c", "d"];

describe("moveWithin", () => {
  it("moves an item before another", () => {
    expect(moveWithin(order, "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("moves to the end when there is no target", () => {
    expect(moveWithin(order, "a", null)).toEqual(["b", "c", "d", "a"]);
  });

  it("returns null for no-ops and foreign ids", () => {
    expect(moveWithin(order, "b", "c")).toBeNull();
    expect(moveWithin(order, "b", "b")).toBeNull();
    expect(moveWithin(order, "z", "a")).toBeNull();
    expect(moveWithin(order, "a", "z")).toBeNull();
  });
});

describe("moveBy", () => {
  it("swaps with a neighbour", () => {
    expect(moveBy(order, "b", -1)).toEqual(["b", "a", "c", "d"]);
    expect(moveBy(order, "b", 1)).toEqual(["a", "c", "b", "d"]);
  });

  it("returns null at the edges", () => {
    expect(moveBy(order, "a", -1)).toBeNull();
    expect(moveBy(order, "d", 1)).toBeNull();
  });
});
