"use client";

import type { ReactNode } from "react";
import { isImmersive } from "@/lib/site-style";
import { cn } from "@/lib/cn";
import { ImmersiveScroll, type Scene } from "../motion/scroll-provider";
import { useSiteStyle } from "../styles/use-site-style";

/** A hairline that a scene can draw across. Decoration: the row under it never moves. */
export function Rule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      data-rule
      className={cn("block h-px origin-left bg-border", className)}
    />
  );
}

/** Draws every rule in the beat across, in the style's own timing. */
export function ruleScene({ gsap, el, motion }: Scene) {
  gsap.from(el.querySelectorAll("[data-rule]"), {
    scaleX: 0,
    duration: motion.duration * 1.5,
    ease: motion.ease,
    stagger: motion.stagger,
    scrollTrigger: { trigger: el, start: "top 75%" },
  });
}

/** A title that fills a first screen settles towards its place as it scrolls away. */
export function settleScene({ gsap, el }: Scene) {
  gsap.to(el.querySelector("[data-title]"), {
    scale: 0.7,
    transformOrigin: "left bottom",
    ease: "none",
    scrollTrigger: {
      trigger: el,
      start: "top top",
      end: "bottom top",
      scrub: true,
    },
  });
}

/** The thin line that fills as a long column is read. */
export function progressScene({ gsap, el }: Scene) {
  gsap.fromTo(
    el.querySelector("[data-progress]"),
    { scaleX: 0 },
    {
      scaleX: 1,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
      },
    },
  );
}

/** The next item's title rises to fill the screen. */
export function handoffScene({ gsap, el }: Scene) {
  gsap.from(el.querySelector("[data-next]"), {
    yPercent: 30,
    ease: "none",
    scrollTrigger: {
      trigger: el,
      start: "top bottom",
      end: "bottom bottom",
      scrub: true,
    },
  });
}

/** The head of a list or reading page: a meta line, the page's one h1, a lead. */
export function PageTitle({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
}) {
  return (
    <header>
      {eyebrow && <p className="im-mono">{eyebrow}</p>}
      <h1 className={cn("im-display im-display-lg", eyebrow && "mt-4")}>
        {title}
      </h1>
      {lead && <p className="t-lead mt-5 max-w-prose text-pretty">{lead}</p>}
    </header>
  );
}

/** A filter pill: pressed is filled, unpressed is outlined. */
export function Chip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "im-mono inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 transition-colors duration-fast focus-ring",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:border-foreground hover:text-foreground",
      )}
    >
      {children}
      {typeof count === "number" && (
        <span aria-hidden className="opacity-70">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Scroll motion for an immersive page. Under Classic (the harness and the
 * settings preview can render a layout there) the page is the plain document.
 */
export function WithScroll({ children }: { children: ReactNode }) {
  const style = useSiteStyle();
  return isImmersive(style) ? (
    <ImmersiveScroll style={style}>{children}</ImmersiveScroll>
  ) : (
    <>{children}</>
  );
}
