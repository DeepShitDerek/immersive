import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({ style: undefined as unknown }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/supabase/client", () => ({ supabase: null }));
vi.mock("@/store/hooks", () => ({ useAppDispatch: () => vi.fn() }));
vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => ({ setScheme: vi.fn() }),
}));
vi.mock("@/store/api/admin/searchApi", () => ({
  useSearchWorkspaceQuery: () => ({ data: [], isFetching: false }),
}));
vi.mock("@/store/api/publicApi", () => ({
  useGetSiteIdentityQuery: () => ({
    data:
      state.style === undefined
        ? undefined
        : { profile_data: { site_style: state.style } },
  }),
}));

import { CommandPalette } from "./command-palette";

beforeAll(() => {
  // cmdk measures and scrolls its list; jsdom has neither.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  state.style = undefined;
});

function openPalette() {
  render(<CommandPalette />);
  act(() => {
    document.dispatchEvent(new Event("open-command-palette"));
  });
}

describe("CommandPalette: light and dark", () => {
  it.each([undefined, "classic"])(
    "offers Light Mode and Dark Mode when the style is %j",
    (style) => {
      state.style = style;
      openPalette();
      expect(screen.getByText("Light Mode")).toBeTruthy();
      expect(screen.getByText("Dark Mode")).toBeTruthy();
    },
  );

  it.each(["noir", "paper", "dusk"])(
    "does not offer them under %s, where the style sets the scheme",
    (style) => {
      state.style = style;
      openPalette();
      // The palette is open: its other commands are there.
      expect(screen.getByText("Copy Current URL")).toBeTruthy();
      expect(screen.queryByText("Light Mode")).toBeNull();
      expect(screen.queryByText("Dark Mode")).toBeNull();
    },
  );
});
