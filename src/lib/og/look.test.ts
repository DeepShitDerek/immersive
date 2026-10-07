import { describe, expect, it } from "vitest";
import { contrastRatioHex } from "@/lib/color-utils";
import { STYLE_DEFINITIONS } from "@/features/immersive/styles";
import { SITE_STYLES } from "@/lib/site-style";
import { ogLook } from "./look";

const ratio = (a: string, b: string) => contrastRatioHex(a, b) ?? 0;

describe("ogLook", () => {
  it("keeps the Classic card exactly as it was", () => {
    expect(ogLook("classic")).toEqual({
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
    });
  });

  it.each([undefined, null, "", "neon", 3])(
    "falls back to the Classic card for a style of %j",
    (value) => {
      expect(ogLook(value)).toEqual(ogLook("classic"));
    },
  );

  it.each(["noir", "paper", "dusk"] as const)(
    "draws %s in the style's own colours",
    (style) => {
      const look = ogLook(style);
      const { colors, display } = STYLE_DEFINITIONS[style];
      expect(look.ground).toBe(colors.page);
      expect(look.ink).toBe(colors.text);
      expect(look.muted).toBe(colors.muted);
      expect(look.accent).toBe(colors.accent);
      expect(look.onAccent).toBe(colors.onAccent);
      expect(look.uppercase).toBe(display.uppercase);
      expect(look.tracking).toBe(display.tracking);
    },
  );

  it("sets Paper's title in the serif and the others in the grotesque", () => {
    expect(ogLook("paper").headingFont).toBe("Instrument Serif");
    expect(ogLook("noir").headingFont).toBe("Inter Tight");
    expect(ogLook("dusk").headingFont).toBe("Inter Tight");
    // The serif has one weight; asking for bold would be synthesised.
    expect(ogLook("paper").headingWeight).toBe(400);
  });

  it("only Dusk has the colour glow", () => {
    expect(SITE_STYLES.filter((style) => ogLook(style).glow)).toEqual(["dusk"]);
  });

  it.each(SITE_STYLES)("%s is readable at thumbnail size", (style) => {
    const look = ogLook(style);
    expect(ratio(look.ink, look.ground)).toBeGreaterThanOrEqual(7);
    expect(ratio(look.muted, look.ground)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(look.accent, look.ground)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(look.onAccent, look.accent)).toBeGreaterThanOrEqual(4.5);
  });
});
