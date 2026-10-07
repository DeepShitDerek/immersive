"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { ImmersiveStyle } from "@/lib/site-style";
import { STYLE_DEFINITIONS, type StyleDefinition } from "../styles";
import { motionMode, readMotionEnv } from "./motion-mode";

type Gsap = typeof import("gsap").gsap;
type ScrollTriggerStatic = typeof import("gsap/ScrollTrigger").ScrollTrigger;

interface Kit {
  gsap: Gsap;
  ScrollTrigger: ScrollTriggerStatic;
  pin: boolean;
  motion: StyleDefinition["motion"];
}

export interface Scene extends Kit {
  /** The beat's root element. Selectors in a scene are scoped to it. */
  el: HTMLElement;
}

const KitContext = createContext<Kit | null>(null);

/** Two frames: the first screen has painted before the libraries are fetched. */
function afterPaint(run: () => void): () => void {
  let second = 0;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(run);
  });
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
  };
}

/**
 * Loads GSAP, ScrollTrigger and Lenis for an immersive page, after first
 * paint, and hands them to the beats below through `useScene`.
 *
 * Until it has loaded, and for good under reduced motion, there is no kit and
 * no scene runs: the page is the server-rendered document, which is complete.
 * The imports are dynamic and this component is only ever rendered by an
 * immersive layout, so Classic never downloads them.
 */
export function ImmersiveScroll({
  style,
  children,
}: {
  style: ImmersiveStyle;
  children: ReactNode;
}) {
  const [kit, setKit] = useState<Kit | null>(null);
  const motion = STYLE_DEFINITIONS[style].motion;

  useEffect(() => {
    const mode = motionMode(readMotionEnv());
    if (!mode.animate) return;

    let cancelled = false;
    let stopSmooth = () => {};
    const cancelWait = afterPaint(() => {
      void (async () => {
        const [{ gsap }, { ScrollTrigger }] = await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        if (mode.smooth) {
          const { default: Lenis } = await import("lenis");
          if (cancelled) return;
          // `anchors`: hash links scroll through Lenis instead of jumping.
          // `allowNestedScroll`: a code block or table that scrolls sideways
          // keeps its own wheel; without it Lenis takes every wheel event.
          const lenis = new Lenis({ anchors: true, allowNestedScroll: true });
          lenis.on("scroll", ScrollTrigger.update);
          const tick = (time: number) => lenis.raf(time * 1000);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
          stopSmooth = () => {
            gsap.ticker.remove(tick);
            lenis.destroy();
          };
        }
        setKit({ gsap, ScrollTrigger, pin: mode.pin, motion });
      })();
    });

    return () => {
      cancelled = true;
      cancelWait();
      stopSmooth();
    };
  }, [motion]);

  return <KitContext.Provider value={kit}>{children}</KitContext.Provider>;
}

/**
 * Runs `build` for a beat once the kit is ready, inside a gsap context scoped
 * to the beat, and reverts everything it made on unmount or a style change.
 *
 * `build` must be defined at module level so its identity is stable.
 */
export function useScene(
  ref: RefObject<HTMLElement | null>,
  build: (scene: Scene) => void,
): void {
  const kit = useContext(KitContext);
  useEffect(() => {
    const el = ref.current;
    if (!kit || !el) return;
    const context = kit.gsap.context(() => build({ ...kit, el }), el);
    return () => context.revert();
  }, [kit, ref, build]);
}
