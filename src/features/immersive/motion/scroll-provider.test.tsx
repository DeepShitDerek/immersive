import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useRef } from "react";

const lib = vi.hoisted(() => {
  const lenisInstances: {
    options: Record<string, unknown>;
    destroy: ReturnType<typeof vi.fn>;
  }[] = [];
  return {
    lenisInstances,
    tickerAdd: vi.fn(),
    tickerRemove: vi.fn(),
    revert: vi.fn(),
    imported: { gsap: 0 },
  };
});

vi.mock("gsap", () => {
  lib.imported.gsap += 1;
  return {
    gsap: {
      registerPlugin: vi.fn(),
      ticker: {
        add: lib.tickerAdd,
        remove: lib.tickerRemove,
        lagSmoothing: vi.fn(),
      },
      context: (run: () => void) => {
        run();
        return { revert: lib.revert };
      },
    },
  };
});
vi.mock("gsap/ScrollTrigger", () => ({ ScrollTrigger: { update: vi.fn() } }));
vi.mock("lenis", () => ({
  default: class {
    options: Record<string, unknown>;
    destroy = vi.fn();
    on = vi.fn();
    raf = vi.fn();
    constructor(options: Record<string, unknown>) {
      this.options = options;
      lib.lenisInstances.push(this);
    }
  },
}));

import { ImmersiveScroll, useScene, type Scene } from "./scroll-provider";

const built = vi.fn();
function scene(s: Scene) {
  built({ pin: s.pin, duration: s.motion.duration, tag: s.el.tagName });
}
function Beat() {
  const ref = useRef<HTMLElement>(null);
  useScene(ref, scene);
  return <section ref={ref} />;
}

/** Answers matchMedia from a set of queries that should match. */
function media(matching: string[]) {
  window.matchMedia = ((query: string) => ({
    matches: matching.some((m) => query.includes(m)),
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as never;
}

beforeEach(() => {
  built.mockClear();
  lib.tickerAdd.mockClear();
  lib.tickerRemove.mockClear();
  lib.revert.mockClear();
  lib.lenisInstances.length = 0;
});
afterEach(cleanup);

describe("ImmersiveScroll", () => {
  it("builds scenes with smooth scrolling on a desktop with a mouse", async () => {
    media(["min-width: 768px"]);
    render(
      <ImmersiveScroll style="noir">
        <Beat />
      </ImmersiveScroll>,
    );
    await waitFor(() => expect(built).toHaveBeenCalledTimes(1));
    expect(built).toHaveBeenCalledWith({
      pin: true,
      duration: 0.35,
      tag: "SECTION",
    });
    expect(lib.lenisInstances).toHaveLength(1);
    // Code blocks and tables that scroll sideways keep their own wheel.
    expect(lib.lenisInstances[0].options.allowNestedScroll).toBe(true);
  });

  it("runs no scene and no smooth scrolling under reduced motion", async () => {
    media(["prefers-reduced-motion: reduce", "min-width: 768px"]);
    render(
      <ImmersiveScroll style="noir">
        <Beat />
      </ImmersiveScroll>,
    );
    await new Promise((r) => setTimeout(r, 80));
    expect(built).not.toHaveBeenCalled();
    expect(lib.lenisInstances).toHaveLength(0);
  });

  it("scrolls natively on touch but still builds scenes", async () => {
    media(["pointer: coarse"]);
    render(
      <ImmersiveScroll style="paper">
        <Beat />
      </ImmersiveScroll>,
    );
    await waitFor(() => expect(built).toHaveBeenCalledTimes(1));
    expect(built).toHaveBeenCalledWith({
      pin: false,
      duration: 0.8,
      tag: "SECTION",
    });
    expect(lib.lenisInstances).toHaveLength(0);
  });

  it("stops everything it started when it unmounts", async () => {
    media(["min-width: 768px"]);
    const view = render(
      <ImmersiveScroll style="noir">
        <Beat />
      </ImmersiveScroll>,
    );
    await waitFor(() => expect(built).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(lib.revert).toHaveBeenCalledTimes(1);
    expect(lib.lenisInstances[0].destroy).toHaveBeenCalledTimes(1);
    expect(lib.tickerRemove).toHaveBeenCalledWith(
      lib.tickerAdd.mock.calls[0][0],
    );
  });
});
