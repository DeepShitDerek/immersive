import type { ImmersiveStyle } from "@/lib/site-style";

/**
 * One immersive style: a complete look. The three layouts read these and
 * nothing else, so a style can change colour, type, texture and how motion
 * feels, but never structure.
 */
export interface StyleDefinition {
  id: ImmersiveStyle;
  label: string;
  /** One line for the Settings card. */
  description: string;
  /** Fixed per style: immersive styles ignore the visitor's light/dark choice. */
  scheme: "dark" | "light";
  /** Hex. */
  colors: {
    page: string;
    surface: string;
    text: string;
    muted: string;
    hairline: string;
    /** Input outlines: 3:1 against the page. */
    control: string;
    accent: string;
    onAccent: string;
  };
  /** CSS font-family values, built on the next/font variables in fonts.ts. */
  fonts: { display: string; text: string };
  display: {
    weight: number;
    tracking: string;
    leading: string;
    uppercase: boolean;
  };
  texture: "grain" | "rules" | "field";
  /** Noir cuts, Paper turns, Dusk drifts. Seconds; GSAP ease names. */
  motion: { duration: number; ease: string; stagger: number };
}
