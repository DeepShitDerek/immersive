import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * A floating surface — the v3 replacement for bordered cards.
 *
 * v2 separated content with dotted rules and hairline borders, which made every
 * block the same weight. Here a surface is defined by its fill and its shadow;
 * a border appears only via `edge`, for the case where two surfaces of the same
 * fill sit against each other and the shadow alone cannot separate them.
 *
 * `elevation` is not decoration — it encodes interaction state:
 *   1 resting · 2 raised (hover/active) · 3 floating (overlays)
 */
export interface SurfaceProps {
  children: ReactNode;
  /** 1 resting, 2 raised, 3 floating. */
  elevation?: 1 | 2 | 3;
  /** Hairline inset border, for surfaces that meet another of the same fill. */
  edge?: boolean;
  /** Lifts on hover and shows a focus ring when anything inside is focused. */
  interactive?: boolean;
  as?: "div" | "article" | "li" | "section";
  className?: string;
}

const ELEVATION_CLASS = {
  1: "",
  2: "surface-raised",
  3: "surface-float",
} as const;

export function Surface({
  children,
  elevation = 1,
  edge = false,
  interactive = false,
  as: Tag = "div",
  className,
}: SurfaceProps) {
  return (
    <Tag
      className={cn(
        "surface",
        ELEVATION_CLASS[elevation],
        edge && "surface-edge",
        interactive && "surface-interactive",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
