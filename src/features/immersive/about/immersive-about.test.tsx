import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { normalizeSiteContent } from "@/lib/site-identity";

const state = vi.hoisted(() => ({ identity: undefined as unknown }));

vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({ data: state.identity }),
}));
vi.mock("@/features/sections/dynamic-page-content", () => ({
  DynamicPageContent: ({ pagePath }: { pagePath: string }) => (
    <p>cms sections for {pagePath}</p>
  ),
}));

import ImmersiveAbout from "./immersive-about";

const parts = (container: HTMLElement) =>
  [...container.querySelectorAll("[data-part]")].map((el) =>
    el.getAttribute("data-part"),
  );

afterEach(() => {
  cleanup();
  state.identity = undefined;
});

describe("ImmersiveAbout", () => {
  it("renders nothing until the identity is there", () => {
    const { container } = render(<ImmersiveAbout />);
    expect(parts(container)).toEqual([]);
  });

  it("is the name and the owner's sections for a name-only site", () => {
    state.identity = normalizeSiteContent({
      profile_data: { name: "Ada" },
    } as never);
    const { container } = render(<ImmersiveAbout />);
    expect(parts(container)).toEqual(["opening"]);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ada");
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).not.toContain("Status Panel");
    expect(screen.getByText("cms sections for /about")).toBeInTheDocument();
  });

  it("lays out a full profile in order, with every word of the lead visible", () => {
    state.identity = normalizeSiteContent({
      profile_data: {
        name: "Ada",
        title: "Engineer | Writer",
        bio: ["I build ledgers people trust.", "A second paragraph."],
        proof: [{ value: "12", label: "Years" }],
        status_panel: { show: true, title: "Now", availability: "Open" },
        show_profile_picture: true,
        profile_picture_url: "https://example.com/me.jpg",
      },
    } as never);
    const { container } = render(<ImmersiveAbout />);
    expect(parts(container)).toEqual(["opening", "lead", "bio"]);
    expect(
      [...container.querySelectorAll("[data-beat]")].map((el) =>
        el.getAttribute("data-beat"),
      ),
    ).toEqual(["proof", "now"]);

    const lead = container.querySelector('[data-part="lead"]')!;
    expect(lead.textContent).toContain("I build ledgers people trust.");
    const words = lead.querySelectorAll<HTMLElement>("[data-word]");
    expect(words).toHaveLength(5);
    for (const word of words) {
      expect(word.style.opacity).toBe("");
      expect(word.getAttribute("class") ?? "").not.toMatch(
        /opacity-0|invisible|hidden/,
      );
    }
    expect(container.querySelector('[data-part="bio"]')!.textContent).toContain(
      "A second paragraph.",
    );
    expect(container.querySelector("img")!.getAttribute("alt")).toBe("Ada");
    expect(screen.getByText("Engineer")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
