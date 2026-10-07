import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { normalizeSiteContent } from "@/lib/site-identity";

vi.mock("next/navigation", () => ({ usePathname: () => "/work/" }));
vi.mock("@/hooks/use-public-session", () => ({
  usePublicSession: () => ({ session: null, isLoading: false }),
}));
vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({ data: undefined, isLoading: false }),
  useGetNavLinksQuery: () => ({
    data: [
      { label: "Work", href: "/work" },
      { label: "About", href: "/about" },
      { label: "Work with me", href: "/contact" },
    ],
    isLoading: false,
  }),
}));
vi.mock("../styles/fonts", () => ({ immersiveFontVars: "fonts" }));
vi.mock("../styles/immersive.css", () => ({}));

import { ImmersiveShell } from "./immersive-shell";

const identity = normalizeSiteContent({
  profile_data: { logo: { main: "Ada", highlight: "L" } },
  social_links: [
    {
      id: "github",
      label: "GitHub",
      url: "https://github.com/ada",
      is_visible: true,
    },
    { id: "x", label: "Hidden", url: "https://x.com/ada", is_visible: false },
    { id: "bad", label: "Bad", url: "javascript:alert(1)", is_visible: true },
  ],
} as never);

afterEach(cleanup);

describe("ImmersiveShell", () => {
  it("scopes the page to the style and keeps the landmarks", () => {
    const { container } = render(
      <ImmersiveShell style="paper" identity={identity}>
        <p>Body</p>
      </ImmersiveShell>,
    );
    expect(
      container.querySelector('[data-style-scope="paper"]'),
    ).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("marks the document, and lends it the style's fonts while it is mounted", () => {
    const html = document.documentElement;
    const view = render(
      <ImmersiveShell style="dusk" identity={identity}>
        <p>Body</p>
      </ImmersiveShell>,
    );
    expect(
      view.container.querySelector('[data-style-root="dusk"]'),
    ).not.toBeNull();
    // "fonts" is the mocked font-variable class: without it on <html>, a toast
    // drawn under <body> would fall back to the system face.
    expect(html.classList.contains("fonts")).toBe(true);
    view.unmount();
    expect(html.classList.contains("fonts")).toBe(false);
  });

  it("marks the current page and has no scheme toggle", () => {
    render(
      <ImmersiveShell style="noir" identity={identity}>
        <p>Body</p>
      </ImmersiveShell>,
    );
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Work" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav).getByRole("link", { name: "About" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      screen.queryByRole("button", { name: /theme|dark|light/i }),
    ).toBeNull();
  });

  it("lists only visible social links with a safe url", () => {
    render(
      <ImmersiveShell style="dusk" identity={identity}>
        <p>Body</p>
      </ImmersiveShell>,
    );
    const footer = screen.getByRole("contentinfo");
    expect(
      within(footer).getByRole("link", { name: "GitHub" }),
    ).toBeInTheDocument();
    expect(within(footer).queryByRole("link", { name: "Hidden" })).toBeNull();
    expect(within(footer).queryByRole("link", { name: "Bad" })).toBeNull();
  });
});
