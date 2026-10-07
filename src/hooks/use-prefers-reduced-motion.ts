"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * The visitor's reduced-motion setting, without the animation library.
 *
 * framer-motion's `useReducedMotion` answers the same question, but importing
 * it pulls the library into a component that otherwise needs none of it. False
 * on the server and on the first client render, so both agree; a component
 * that must not move before it knows starts still (the rotating title waits
 * for a mount effect anyway).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const media = window.matchMedia?.(QUERY);
    if (!media) return;
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduce;
}
