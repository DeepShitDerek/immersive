import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const state = vi.hoisted(() => ({ style: undefined as unknown }));
vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({
    data:
      state.style === undefined
        ? undefined
        : { profile_data: { site_style: state.style } },
  }),
}));
vi.mock("../styles/fonts", () => ({ immersiveFontVars: "fonts" }));

import { DocumentStyle, SiteStyleDocument } from "./document-style";

afterEach(() => {
  cleanup();
  state.style = undefined;
});

describe("DocumentStyle", () => {
  it("puts the whole document in the style: public site and workspace alike", () => {
    const view = render(<DocumentStyle style="noir" />);
    // The marker the stylesheet's html:has() rule looks for.
    expect(document.querySelector('[data-style-root="noir"]')).not.toBeNull();
    const css = document.querySelector("style[data-site-style]")!.textContent!;
    expect(css).toContain('html:has([data-style-root="noir"])');
    // Nothing visible is added to the page: a stylesheet and a hidden marker.
    expect(
      [...view.container.children].map((el) => el.tagName.toLowerCase()),
    ).toEqual(["style", "span"]);
    expect(view.container.querySelector("span")!.hidden).toBe(true);
  });

  it("lends <html> the style's fonts while it is mounted", () => {
    const html = document.documentElement;
    const view = render(<DocumentStyle style="paper" />);
    expect(html.classList.contains("fonts")).toBe(true);
    view.unmount();
    expect(html.classList.contains("fonts")).toBe(false);
  });
});

describe("SiteStyleDocument", () => {
  it.each(["noir", "paper", "dusk"])("styles the document for %s", (style) => {
    state.style = style;
    render(<SiteStyleDocument />);
    expect(
      document.querySelector(`[data-style-root="${style}"]`),
    ).not.toBeNull();
  });

  it.each([undefined, "classic", "neon", null])(
    "adds nothing for a style of %j, so the theme applies",
    (style) => {
      state.style = style;
      const { container } = render(<SiteStyleDocument />);
      expect(container.innerHTML).toBe("");
      expect(document.querySelector("[data-style-root]")).toBeNull();
    },
  );
});
