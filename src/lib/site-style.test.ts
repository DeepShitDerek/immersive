import { describe, expect, it } from "vitest";
import { SITE_STYLES, isImmersive, resolveSiteStyle } from "./site-style";
import { normalizeSiteContent } from "./site-identity";
import { siteSettingsSchema } from "./schemas";

describe("resolveSiteStyle", () => {
  it("keeps each known style", () => {
    for (const style of SITE_STYLES)
      expect(resolveSiteStyle(style)).toBe(style);
  });

  it.each([undefined, null, "", "neon", "NOIR", " noir", 3, {}, []])(
    "falls back to classic for %j",
    (value) => {
      expect(resolveSiteStyle(value)).toBe("classic");
    },
  );
});

describe("isImmersive", () => {
  it("is false only for classic", () => {
    expect(SITE_STYLES.filter(isImmersive)).toEqual(["noir", "paper", "dusk"]);
  });
});

describe("normalizeSiteContent", () => {
  it("fills a missing site_style with classic", () => {
    expect(normalizeSiteContent({}).profile_data.site_style).toBe("classic");
  });

  it("replaces an unknown site_style with classic", () => {
    const row = { profile_data: { site_style: "neon" } } as never;
    expect(normalizeSiteContent(row).profile_data.site_style).toBe("classic");
  });

  it("keeps a known site_style", () => {
    const row = { profile_data: { site_style: "dusk" } } as never;
    expect(normalizeSiteContent(row).profile_data.site_style).toBe("dusk");
  });
});

describe("siteSettingsSchema", () => {
  const profile = siteSettingsSchema.shape.profile_data.shape;

  it("accepts each style and no value", () => {
    for (const style of SITE_STYLES) {
      expect(profile.site_style.safeParse(style).success).toBe(true);
    }
    expect(profile.site_style.safeParse(undefined).success).toBe(true);
  });

  it("rejects an unknown style", () => {
    expect(profile.site_style.safeParse("neon").success).toBe(false);
  });
});
