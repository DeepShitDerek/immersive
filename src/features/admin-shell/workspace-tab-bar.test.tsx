import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let pathname = "/admin/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

import { WorkspaceTabBar, currentTab } from "./workspace-tab-bar";

describe("workspace tab bar", () => {
  it("marks the tab that owns the path, trailing slash or not", () => {
    expect(currentTab("/admin/")).toBe("/admin");
    expect(currentTab("/admin/tasks/")).toBe("/admin/tasks");
    expect(currentTab("/admin/finance/?area=plan")).toBe("/admin/finance");
  });

  it("makes More current for a module without a tab", () => {
    expect(currentTab("/admin/library/")).toBeNull();
    pathname = "/admin/library/";
    render(<WorkspaceTabBar />);
    const nav = screen.getByRole("navigation", { name: "Workspace" });
    expect(nav.querySelector('[aria-current="page"]')).toBeNull();
    expect(screen.getByRole("button", { name: "More" }).className).toContain(
      "text-primary",
    );
  });

  it("names the current tab for assistive tech", () => {
    pathname = "/admin/notes/";
    render(<WorkspaceTabBar />);
    expect(
      screen.getByRole("link", { name: "Notes" }).getAttribute("aria-current"),
    ).toBe("page");
  });
});
