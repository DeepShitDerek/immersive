"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  isPenPointer,
  readStylusOnly,
  shouldBlockPointer,
  writeStylusOnly,
} from "./pen-input";

export interface PenInput {
  /** Attach to the element wrapping the canvas. */
  ref: (node: HTMLElement | null) => void;
  /** True once a stylus has touched this surface. */
  hasPen: boolean;
  stylusOnly: boolean;
  setStylusOnly: (value: boolean) => void;
}

/**
 * Palm rejection for the drawing surface.
 *
 * Excalidraw listens for pointer events on its own canvas, so the only place to
 * intercept a palm is above it: these listeners run in the **capture** phase on
 * the wrapper, before the event reaches the library, and stop propagation for
 * the touches that should not draw.
 *
 * `passive: false` is required — `preventDefault` on a touch pointer is what
 * stops iOS treating the same gesture as a page scroll, and a passive listener
 * is not allowed to call it.
 */
export function usePenInput(): PenInput {
  const [hasPen, setHasPen] = useState(false);
  const [stylusOnly, setStylusOnlyState] = useState(false);

  const nodeRef = useRef<HTMLElement | null>(null);
  // Read inside the handler rather than closed over, so the listeners never
  // need re-binding when the preference changes.
  const stylusOnlyRef = useRef(false);
  const activeTouches = useRef(new Set<number>());

  useEffect(() => {
    const saved = readStylusOnly(
      typeof window === "undefined" ? undefined : window.localStorage,
    );
    setStylusOnlyState(saved);
    stylusOnlyRef.current = saved;
  }, []);

  const setStylusOnly = useCallback((value: boolean) => {
    setStylusOnlyState(value);
    stylusOnlyRef.current = value;
    writeStylusOnly(
      value,
      typeof window === "undefined" ? undefined : window.localStorage,
    );
  }, []);

  const ref = useCallback((node: HTMLElement | null) => {
    // Detach from whatever we were on before adopting the new node.
    const previous = nodeRef.current;
    if (previous) {
      const cleanup = (previous as HTMLElement & { __penCleanup?: () => void })
        .__penCleanup;
      cleanup?.();
    }
    nodeRef.current = node;
    if (!node) return;

    const release = (event: PointerEvent) => {
      activeTouches.current.delete(event.pointerId);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        activeTouches.current.add(event.pointerId);
      }

      // A stylus anywhere on the surface is what reveals the control; there is
      // no reliable way to ask whether a pen exists before it is used.
      if (isPenPointer(event.pointerType)) {
        setHasPen(true);
        // A pen and a palm can be down together. Once the nib is active the
        // palm's touch points are stale, and keeping them would make the next
        // finger look like a two-finger gesture.
        activeTouches.current.clear();
        return;
      }

      if (
        shouldBlockPointer({
          pointerType: event.pointerType,
          stylusOnly: stylusOnlyRef.current,
          activeTouches: activeTouches.current.size,
        })
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (
        shouldBlockPointer({
          pointerType: event.pointerType,
          stylusOnly: stylusOnlyRef.current,
          activeTouches: activeTouches.current.size,
        })
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    node.addEventListener("pointerdown", onPointerDown, {
      capture: true,
      passive: false,
    });
    node.addEventListener("pointermove", onPointerMove, {
      capture: true,
      passive: false,
    });
    node.addEventListener("pointerup", release, { capture: true });
    node.addEventListener("pointercancel", release, { capture: true });

    (node as HTMLElement & { __penCleanup?: () => void }).__penCleanup = () => {
      node.removeEventListener("pointerdown", onPointerDown, { capture: true });
      node.removeEventListener("pointermove", onPointerMove, { capture: true });
      node.removeEventListener("pointerup", release, { capture: true });
      node.removeEventListener("pointercancel", release, { capture: true });
      activeTouches.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      const node = nodeRef.current as
        | (HTMLElement & { __penCleanup?: () => void })
        | null;
      node?.__penCleanup?.();
    };
  }, []);

  return { ref, hasPen, stylusOnly, setStylusOnly };
}
