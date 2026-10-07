import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => "/admin/notes/",
  useSearchParams: () => new URLSearchParams(search),
}));
const { useUrlParam } = await import("./use-url-param");

beforeEach(() => {
  vi.clearAllMocks();
  search = "?view=list";
  window.history.replaceState(null, "", `/admin/notes/${search}`);
});

describe("open item in the URL", () => {
  it("reads the value and writes it, keeping other parameters", () => {
    search = "?view=list&note=n1";
    window.history.replaceState(null, "", `/admin/notes/${search}`);
    const { result } = renderHook(() => useUrlParam("note"));
    expect(result.current[0]).toBe("n1");
    act(() => result.current[1]("n2"));
    expect(push).toHaveBeenCalledWith("/admin/notes/?view=list&note=n2", {
      scroll: false,
    });
    act(() => result.current[1](null, "replace"));
    expect(replace).toHaveBeenCalledWith("/admin/notes/?view=list", {
      scroll: false,
    });
  });

  it("uses the hook's default mode, and skips a write that changes nothing", () => {
    const { result } = renderHook(() => useUrlParam("note", "replace"));
    expect(result.current[0]).toBeNull();
    act(() => result.current[1]("n1"));
    expect(replace).toHaveBeenCalledWith("/admin/notes/?view=list&note=n1", {
      scroll: false,
    });
    act(() => result.current[1](null));
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
