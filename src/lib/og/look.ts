import { STYLE_DEFINITIONS } from "@/features/immersive/styles";
import { isImmersive, resolveSiteStyle } from "@/lib/site-style";

/**
 * How a link-preview card is drawn: its colours, its two faces, how the title
 * is set. One per site style, so a link shared from a Noir site looks like
 * the page it opens.
 */
export interface OgLook {
  ground: string;
  ink: string;
  muted: string;
  accent: string;
  /** The initial inside the accent disc. */
  onAccent: string;
  /** Font names as registered with the renderer (card.tsx). */
  headingFont: "Heading" | "Inter Tight" | "Instrument Serif";
  bodyFont: "Body" | "Inter Tight";
  headingWeight: 400 | 700;
  tracking: string;
  uppercase: boolean;
  /** Dusk's soft colour in the corners. */
  glow: boolean;
}

/**
 * The card as it has always been: Space Grotesk over Inter on the warm
 * ground, blue accent. Deliberately not the owner's theme: there are 56 of
 * those, and this pairing is the one checked to read at thumbnail size.
 */
const CLASSIC: OgLook = {
  ground: "#f9f8f5",
  ink: "#1f2328",
  muted: "#5b636e",
  accent: "#0b6bdb",
  onAccent: "#ffffff",
  headingFont: "Heading",
  bodyFont: "Body",
  headingWeight: 700,
  tracking: "-0.02em",
  uppercase: false,
  glow: false,
};

/**
 * The look for a site style. An immersive style brings its own: the colours
 * are the style definition's, so the card cannot drift from the pages (and
 * the contrast test on those definitions covers the card too). Anything else
 * is the Classic card.
 */
export function ogLook(style: unknown): OgLook {
  const resolved = resolveSiteStyle(style);
  if (!isImmersive(resolved)) return CLASSIC;
  const { colors, display, texture } = STYLE_DEFINITIONS[resolved];
  const serif = resolved === "paper";
  return {
    ground: colors.page,
    ink: colors.text,
    muted: colors.muted,
    accent: colors.accent,
    onAccent: colors.onAccent,
    headingFont: serif ? "Instrument Serif" : "Inter Tight",
    bodyFont: "Inter Tight",
    // The serif has a single weight; asking for bold would be synthesised.
    headingWeight: serif ? 400 : 700,
    tracking: display.tracking,
    uppercase: display.uppercase,
    glow: texture === "field",
  };
}
