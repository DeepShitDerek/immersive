import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PortfolioSection, SiteContent } from "@/types";
// vi.mock below is hoisted above these, so they see the mocked data layer.
import { publicApi } from "@/store/api/publicApi";
import { seedPublicCache } from "./public-preload";

const fetchSectionsByPath = vi.fn();
const fetchSiteIdentity = vi.fn();

vi.mock("@/lib/public-data", () => ({
  fetchSectionsByPath: (path: string) => fetchSectionsByPath(path),
  fetchSiteIdentity: () => fetchSiteIdentity(),
  fetchNavLinks: vi.fn(),
  fetchPublishedPosts: vi.fn(),
  fetchPostBySlug: vi.fn(),
  fetchPublishedLifeUpdates: vi.fn(),
}));

function makeStore() {
  return configureStore({
    reducer: { [publicApi.reducerPath]: publicApi.reducer },
    middleware: (getDefault) => getDefault().concat(publicApi.middleware),
  });
}
type TestStore = ReturnType<typeof makeStore>;
const seed = (store: TestStore, data: Parameters<typeof seedPublicCache>[2]) =>
  seedPublicCache(
    store.getState() as Parameters<typeof seedPublicCache>[0],
    store.dispatch as Parameters<typeof seedPublicCache>[1],
    data,
  );

const section = (title: string) =>
  ({ id: title, title }) as unknown as PortfolioSection;
const identity = { profile_data: { name: "Build" } } as unknown as SiteContent;

beforeEach(() => {
  fetchSectionsByPath.mockReset();
  fetchSiteIdentity.mockReset();
});

describe("seedPublicCache", () => {
  it("makes build-time data readable synchronously, before any fetch", () => {
    const store = makeStore();
    seed(store, {
      sectionsByPath: { "/": [section("built")] },
      siteIdentity: identity,
    });

    const cached = publicApi.endpoints.getSectionsByPath.select("/")(
      store.getState() as never,
    );
    expect(cached.data).toEqual([section("built")]);
    expect(
      publicApi.endpoints.getSiteIdentity.select()(store.getState() as never)
        .data,
    ).toBe(identity);
    expect(fetchSectionsByPath).not.toHaveBeenCalled();
  });

  it("never replaces data that is already cached", () => {
    const store = makeStore();
    seed(store, { sectionsByPath: { "/": [section("live")] } });
    const tags = seed(store, {
      sectionsByPath: { "/": [section("stale build")] },
    });

    expect(tags).toEqual([]);
    const cached = publicApi.endpoints.getSectionsByPath.select("/")(
      store.getState() as never,
    );
    expect(cached.data).toEqual([section("live")]);
  });

  it("does nothing without data", () => {
    expect(seed(makeStore(), undefined)).toEqual([]);
  });

  it("returns tags that make a subscribed query refetch live data", async () => {
    const store = makeStore();
    const tags = seed(store, { sectionsByPath: { "/": [section("built")] } });
    expect(tags).toEqual([{ type: "Portfolio", id: "/" }]);

    fetchSectionsByPath.mockResolvedValue({ data: [section("live")] });
    const subscription = store.dispatch(
      publicApi.endpoints.getSectionsByPath.initiate("/"),
    );
    // Cached: subscribing alone does not fetch.
    expect(fetchSectionsByPath).not.toHaveBeenCalled();

    store.dispatch(publicApi.util.invalidateTags(tags));
    await vi.waitFor(() => {
      const cached = publicApi.endpoints.getSectionsByPath.select("/")(
        store.getState() as never,
      );
      expect(cached.data).toEqual([section("live")]);
    });
    expect(fetchSectionsByPath).toHaveBeenCalledWith("/");
    subscription.unsubscribe();
  });
});
