import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A full-bleed horizontal band — the unit every public page is built from.
 *
 * The v3 organising idea is that a page is a *sequence* of bands whose weights
 * alternate, so it reads with rhythm rather than as one uniform column of
 * same-weight blocks. The band owns the full viewport width and its own
 * background; `width` constrains the content inside it.
 *
 * Weights:
 *  - `feature` — large type, generous vertical space, at most one idea
 *  - `content` — the working band; grids and prose live here
 *  - `accent`  — a tinted surface, used sparingly to close a section or carry
 *                a call to action. Two adjacent accent bands is a mistake.
 */
type BandWeight = "feature" | "content" | "accent";
type BandWidth = "default" | "wide" | "prose";
/** `tight` joins a band to the one before it as one group (48px). */
type BandRhythm = "normal" | "tight";

const WEIGHT_CLASS: Record<BandWeight, string> = {
  feature: "band band-feature",
  content: "band band-content",
  accent: "band band-accent",
};

const WIDTH_CLASS: Record<BandWidth, string> = {
  default: "band-inner",
  wide: "band-inner band-inner-wide",
  prose: "band-inner band-inner-prose",
};

export interface BandProps {
  children: ReactNode;
  weight?: BandWeight;
  width?: BandWidth;
  rhythm?: BandRhythm;
  /** Rendered as a landmark when the band is a titled region of the page. */
  as?: "section" | "div" | "header" | "footer";
  id?: string;
  "aria-labelledby"?: string;
  className?: string;
  /** Applied to the inner constrained wrapper rather than the full-bleed band. */
  innerClassName?: string;
}

export function Band({
  children,
  weight = "content",
  width = "default",
  rhythm = "normal",
  as: Tag = "section",
  id,
  className,
  innerClassName,
  ...rest
}: BandProps) {
  return (
    <Tag
      id={id}
      className={cn(
        WEIGHT_CLASS[weight],
        rhythm === "tight" && "band-tight",
        className,
      )}
      {...rest}
    >
      <div className={cn(WIDTH_CLASS[width], innerClassName)}>{children}</div>
    </Tag>
  );
}

/**
 * The heading block that opens a band.
 *
 * Hierarchy is carried by size: an optional eyebrow in the meta voice, then
 * the title. A band that wants a rule draws it on itself.
 */
export function BandHeading({
  eyebrow,
  title,
  lead,
  actions,
  id,
  level = 2,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
  id?: string;
  level?: 1 | 2;
  className?: string;
}) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-prose">
        {eyebrow && <p className="t-eyebrow mb-2">{eyebrow}</p>}
        {/* Section titles at the title size: the scale used to jump
            from the 68px display straight to 28px, so sections read flat. */}
        <Heading id={id} className="t-title text-balance">
          {title}
        </Heading>
        {lead && <p className="t-lead mt-3">{lead}</p>}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}
