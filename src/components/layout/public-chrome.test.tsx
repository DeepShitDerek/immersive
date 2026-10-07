import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { normalizeSiteContent } from "@/lib/site-identity";

const state = vi.hoisted(() => ({
  style: "classic" as string,
  lockdown: 0,
}));

vi.mock("@/store/api/publicApi", () => ({
  useGetLockdownStatusQuery: () => ({ data: state.lockdown }),
  useGetSiteIdentityQuery: () => ({
    data: normalizeSiteContent({
      profile_data: { site_style: state.style },
    } as never),
    isLoading: false,
  }),
  useGetNavLinksQuery: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/use-public-session", () => ({
  usePublicSession: () => ({ session: null, isLoading: false }),
}));
vi.mock("@/features/analytics/use-visit-tracker", () => ({
  useVisitTracker: () => {},
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/components/layout/site-header", () => ({
  default: () => <header>classic header</header>,
  isActivePath: () => false,
}));
vi.mock("@/components/layout/public-footer", () => ({
  default: () => <footer>classic footer</footer>,
}));
vi.mock("@/components/layout/maintenance-view", () => ({
  default: ({ level }: { level: number }) => <p>maintenance level {level}</p>,
}));
vi.mock("@/features/immersive/styles/fonts", () => ({
  immersiveFontVars: "fonts",
}));
vi.mock("@/features/immersive/styles/immersive.css", () => ({}));

import PublicChrome from "./public-chrome";

afterEach(() => {
  cleanup();
  state.style = "classic";
  state.lockdown = 0;
});

describe("PublicChrome", () => {
  it("is the Classic chrome for the Classic style", () => {
    const { container } = render(
      <PublicChrome>
        <p>page</p>
      </PublicChrome>,
    );
    expect(screen.getByText("classic header")).toBeInTheDocument();
    expect(container.querySelector("[data-style-root]")).toBeNull();
    expect(
      container.querySelector('[data-style-scope="classic"]'),
    ).not.toBeNull();
  });

  it(
    "is the immersive shell for an immersive style",
    { timeout: 15000 },
    async () => {
      state.style = "paper";
      const { container } = render(
        <PublicChrome>
          <p>page</p>
        </PublicChrome>,
      );
      // The shell is a lazy chunk; its first load takes a moment.
      expect(
        await screen.findByText("page", undefined, { timeout: 8000 }),
      ).toBeInTheDocument();
      expect(screen.queryByText("classic header")).toBeNull();
      expect(
        container.querySelector('[data-style-root="paper"]'),
      ).not.toBeNull();
    },
  );

  it(
    "shows the maintenance screen in the site's style too",
    { timeout: 15000 },
    async () => {
      state.style = "noir";
      state.lockdown = 1;
      const { container } = render(
        <PublicChrome>
          <p>page</p>
        </PublicChrome>,
      );
      const screenText = await screen.findByText(
        "maintenance level 1",
        undefined,
        { timeout: 8000 },
      );
      expect(screen.queryByText("page")).toBeNull();
      const root = container.querySelector('[data-style-scope="noir"]');
      expect(root).not.toBeNull();
      expect(root!.contains(screenText)).toBe(true);
    },
  );

  it("shows the Classic maintenance screen for the Classic style", () => {
    state.lockdown = 1;
    const { container } = render(
      <PublicChrome>
        <p>page</p>
      </PublicChrome>,
    );
    expect(screen.getByText("maintenance level 1")).toBeInTheDocument();
    expect(container.querySelector("[data-style-root]")).toBeNull();
  });
});
