/**
 * What motion a visitor gets. One place, so the rule is the same for every
 * beat: reduced motion gets none of it, touch scrolls natively, a narrow
 * screen is never pinned.
 *
 * `pin` mirrors the media query on `.im-pin` (immersive.css): the CSS does the
 * pinning, this tells a scene whether its section is pinned.
 */
export function motionMode(env: {
  reduced: boolean;
  coarse: boolean;
  narrow: boolean;
}): { animate: boolean; smooth: boolean; pin: boolean } {
  if (env.reduced) return { animate: false, smooth: false, pin: false };
  return { animate: true, smooth: !env.coarse, pin: !env.narrow };
}

/** Browser only. */
export function readMotionEnv(): {
  reduced: boolean;
  coarse: boolean;
  narrow: boolean;
} {
  const matches = (query: string) =>
    window.matchMedia?.(query).matches ?? false;
  return {
    reduced: matches("(prefers-reduced-motion: reduce)"),
    coarse: matches("(pointer: coarse)"),
    // The same condition as `.im-pin`: wide enough, and tall enough that a
    // full-screen panel has room (a phone on its side is 390px tall).
    narrow: !matches("(min-width: 768px) and (min-height: 700px)"),
  };
}
