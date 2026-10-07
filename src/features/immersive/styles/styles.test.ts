import { describe, expect, it } from "vitest";
import { contrastRatioHex } from "@/lib/color-utils";
import { IMAGE_SCRIM, STYLE_DEFINITIONS } from "./index";
import { styleCss, styleVars } from "./css";

const defs = Object.values(STYLE_DEFINITIONS);
const ratio = (a: string, b: string) => contrastRatioHex(a, b) ?? 0;

describe("style definitions", () => {
  it("has one definition per immersive style, keyed by its id", () => {
    expect(Object.keys(STYLE_DEFINITIONS)).toEqual(["noir", "paper", "dusk"]);
    for (const [id, def] of Object.entries(STYLE_DEFINITIONS)) {
      expect(def.id).toBe(id);
    }
  });

  it.each(defs)("$id meets WCAG AA", ({ colors }) => {
    expect(ratio(colors.text, colors.page)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colors.text, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colors.muted, colors.page)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colors.muted, colors.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colors.accent, colors.page)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    // Form-control outlines and focus rings: non-text contrast, 3:1.
    expect(ratio(colors.control, colors.page)).toBeGreaterThanOrEqual(3);
  });

  it.each(defs)(
    "$id has a scheme that matches its ground",
    ({ colors, scheme }) => {
      const darkGround =
        ratio(colors.page, "#ffffff") > ratio(colors.page, "#000000");
      expect(scheme).toBe(darkGround ? "dark" : "light");
    },
  );
});

/** `over` at `alpha` on top of `under`, per channel, as a hex colour. */
function composite(over: string, under: string, alpha: number): string {
  const channel = (hex: string, i: number) =>
    parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(channel(over, i) * alpha + channel(under, i) * (1 - alpha)),
      )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
}

describe("the scrim over a project image", () => {
  it.each(defs)(
    "$id keeps text at AA over the lightest and darkest image",
    ({ colors }) => {
      for (const image of ["#ffffff", "#000000"]) {
        const ground = composite(colors.page, image, IMAGE_SCRIM);
        expect(
          ratio(colors.text, ground),
          `text on ${image}`,
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          ratio(colors.muted, ground),
          `muted on ${image}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});

describe("styleVars", () => {
  it("writes every token the public components read, as HSL triples", () => {
    const vars = styleVars(STYLE_DEFINITIONS.noir);
    for (const token of [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--muted",
      "--muted-foreground",
      "--accent",
      "--accent-foreground",
      "--border",
      "--input",
      "--ring",
      "--success",
      "--warning",
      "--info",
      "--destructive",
      // The workspace charts: without these a chart keeps the theme colours
      // on the style ground.
      "--chart-1",
      "--chart-2",
      "--chart-3",
      "--chart-4",
      "--chart-5",
    ]) {
      expect(vars[token], token).toMatch(
        /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/,
      );
    }
    expect(vars["--font-heading"]).toContain("var(--font-");
    expect(vars["--font-body"]).toContain("var(--font-");
  });
});

describe("tokens that existing pages read", () => {
  it.each(defs)("$id redefines the elevation rings inside the scope", (def) => {
    // themes.css defines --e-1/--e-2 on <html>, where their var(--border)
    // resolves to the Classic theme's colour. Unless the scope redefines
    // them, every card on a dark style gets a light ring.
    const vars = styleVars(def);
    for (const token of ["--e-1", "--e-2", "--e-3"]) {
      expect(vars[token], token).toContain("hsl(var(--border))");
    }
  });

  it.each(defs)(
    "$id keeps the display tracking for display type only",
    (def) => {
      const vars = styleVars(def);
      expect(vars["--im-display-tracking"]).toBe(def.display.tracking);
      // Small headings on the restyled pages: tight display tracking makes
      // their letters touch.
      expect(vars["--heading-letter-spacing"]).toBe("-0.02em");
    },
  );
});

describe("the whole document follows the style on a public page", () => {
  const css = styleCss();

  it.each(["noir", "paper", "dusk"])(
    "%s sets its tokens on <html> wherever the immersive shell is on the page",
    (id) => {
      // Toasts, menus and tooltips are drawn outside the page wrapper, straight
      // under <body>. They only take the style if the document itself does.
      const rule = new RegExp(
        String.raw`html:has\(\[data-style-root="${id}"\]\)\{([^}]*)\}`,
      ).exec(css);
      expect(rule, id).not.toBeNull();
      const body = rule![1];
      expect(body).toContain("--background:");
      expect(body).toContain("--font-body:");
      expect(body).toContain("color-scheme:");
      // Over a theme class and over a custom theme's inline colours.
      for (const declaration of body.split(";").filter(Boolean)) {
        expect(declaration, declaration).toMatch(/!important$/);
      }
    },
  );

  it("draws Paper's one-weight serif as cut, in the workspace too", () => {
    // Workspace headings ask for semibold. Instrument Serif has a single
    // weight, and a browser's faked bold makes its small sizes clot.
    const body = (id: string) =>
      new RegExp(
        String.raw`html:has\(\[data-style-root="${id}"\]\)\{([^}]*)\}`,
      ).exec(css)![1];
    expect(body("paper")).toContain("font-synthesis:style !important");
    expect(body("noir")).not.toContain("font-synthesis");
    expect(body("dusk")).not.toContain("font-synthesis");
  });

  it("keys on the shell's own marker, which the settings preview does not carry", () => {
    // The preview frame in the admin has data-style-scope. If the document
    // rule keyed on that, previewing Noir would restyle the whole workspace.
    expect(css).not.toMatch(/html:has\(\[data-style-scope/);
  });
});

describe("styleCss", () => {
  it("scopes each style to its own data-style-scope value", () => {
    const css = styleCss();
    for (const id of ["noir", "paper", "dusk"]) {
      expect(css).toContain(`[data-style-scope="${id}"]{`);
    }
    expect(css).not.toContain("classic");
    expect(css).not.toContain("<");
  });
});
