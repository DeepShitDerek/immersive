import { describe, expect, it } from "vitest";
import { motionMode, readMotionEnv } from "./motion-mode";

describe("motionMode", () => {
  it("is fully on for a desktop with a mouse", () => {
    expect(
      motionMode({ reduced: false, coarse: false, narrow: false }),
    ).toEqual({
      animate: true,
      smooth: true,
      pin: true,
    });
  });

  it("turns everything off for reduced motion, whatever the device", () => {
    for (const coarse of [true, false]) {
      for (const narrow of [true, false]) {
        expect(motionMode({ reduced: true, coarse, narrow })).toEqual({
          animate: false,
          smooth: false,
          pin: false,
        });
      }
    }
  });

  it("uses native scrolling on touch, and still pins on a wide touch screen", () => {
    expect(motionMode({ reduced: false, coarse: true, narrow: false })).toEqual(
      {
        animate: true,
        smooth: false,
        pin: true,
      },
    );
  });

  it("does not pin on a narrow screen", () => {
    expect(motionMode({ reduced: false, coarse: true, narrow: true }).pin).toBe(
      false,
    );
    expect(
      motionMode({ reduced: false, coarse: false, narrow: true }).pin,
    ).toBe(false);
  });
});

describe("readMotionEnv", () => {
  /** A window of this size: answers the width/height queries like a browser. */
  function screenOf(width: number, height: number) {
    window.matchMedia = ((query: string) => {
      const minWidth = /min-width: (\d+)px/.exec(query);
      const minHeight = /min-height: (\d+)px/.exec(query);
      const matches =
        (!minWidth || width >= Number(minWidth[1])) &&
        (!minHeight || height >= Number(minHeight[1])) &&
        !query.includes("reduce") &&
        !query.includes("coarse");
      return { matches };
    }) as never;
  }

  it("treats a laptop as wide enough to pin", () => {
    screenOf(1366, 768);
    expect(readMotionEnv().narrow).toBe(false);
  });

  it("treats a phone as too small to pin, upright or on its side", () => {
    screenOf(390, 844);
    expect(readMotionEnv().narrow).toBe(true);
    // Wide enough, but a pinned full-screen panel has no room: 390px tall.
    screenOf(844, 390);
    expect(readMotionEnv().narrow).toBe(true);
  });
});
