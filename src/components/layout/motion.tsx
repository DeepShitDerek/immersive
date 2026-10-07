import type { ReactNode } from "react";

/**
 * Block wrappers that public sections share: `Reveal`, `Stagger` and
 * `StaggerItem`, plus `CountUp` for a figure.
 *
 * **They no longer move.** Each one used to prerender at `opacity: 0` and
 * wait for an IntersectionObserver and the animation library to bring it in.
 * On a slow phone that left bands blank after scrolling, it held the first
 * meaningful paint behind a script download, and a figure read "0" to anyone
 * who looked before it counted. The rule is
 * that nothing animates on load and no text is animated.
 *
 * The components stay so the nineteen sections that use them keep their
 * structure and element types; they now render exactly that element,
 * visible from the first paint, with no client JavaScript.
 */

/** The house curve — the same one as `--m-enter`, for the few animations left. */
export const EASE = [0.32, 0.72, 0, 1] as const;

type Tag = "div" | "ul" | "ol" | "li" | "article" | "figure";

interface BlockProps {
  as?: Tag;
  className?: string;
  children?: ReactNode;
}

/** A block. `from` and `delay` are accepted for existing callers and unused. */
export function Reveal({
  as: Comp = "div",
  className,
  children,
}: BlockProps & { from?: "up" | "left" | "right"; delay?: number }) {
  return <Comp className={className}>{children}</Comp>;
}

/** A group of `StaggerItem`s. `step` is accepted for existing callers. */
export function Stagger({
  as: Comp = "div",
  className,
  children,
}: BlockProps & { step?: number }) {
  return <Comp className={className}>{children}</Comp>;
}

/** One member of a `Stagger`. */
export function StaggerItem({
  as: Comp = "div",
  className,
  children,
}: BlockProps) {
  return <Comp className={className}>{children}</Comp>;
}

/* ────────────────────────────────────────────────────────────────
 * Figures
 * ──────────────────────────────────────────────────────────────── */

/** A figure, exactly as the author wrote it, in tabular numerals. */
export function CountUp({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return <span className={className}>{value}</span>;
}
