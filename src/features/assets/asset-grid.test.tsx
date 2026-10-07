import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StorageAsset } from "@/types";
import { AssetGrid } from "./asset-views";

const asset = (id: string, name: string, used: number): StorageAsset => ({
  id,
  file_name: name,
  file_path: `site/${name}`,
  mime_type: "image/png",
  size_kb: 12,
  alt_text: null,
  used_in: Array.from({ length: used }, (_, i) => ({
    type: "page",
    id: `p${i}`,
  })),
  created_at: "2026-10-01T00:00:00Z",
});
const ASSETS = [asset("a", "hero.png", 2), asset("b", "old.png", 0)];

const mount = (select = false, onSelect = vi.fn(), onToggleSelect = vi.fn()) =>
  render(
    <AssetGrid
      assets={ASSETS}
      isBulkSelectMode={select}
      bulkSelectedIds={new Set(["a"])}
      onToggleSelect={onToggleSelect}
      onSelect={onSelect}
      onDownload={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

describe("asset grid tiles", () => {
  it("are buttons that open the file, and say whether pages use it", () => {
    const onSelect = vi.fn();
    mount(false, onSelect);
    const tile = screen.getByRole("button", { name: /^hero\.png/ });
    expect(tile.textContent).toMatch(/Used on 2/);
    expect(
      screen.getByRole("button", { name: /^old\.png/ }).textContent,
    ).toMatch(/Unused/);
    fireEvent.click(tile);
    expect(onSelect).toHaveBeenCalledWith(ASSETS[0]);
  });

  it("keep download and delete beside the tile's button, not inside it", () => {
    mount();
    const tile = screen.getByRole("button", { name: /^hero\.png/ });
    expect(within(tile).queryAllByRole("button")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "Delete hero.png" }),
    ).toBeTruthy();
  });

  it("report selection in select mode", () => {
    const onToggleSelect = vi.fn();
    mount(true, vi.fn(), onToggleSelect);
    const tile = screen.getByRole("button", { name: /^hero\.png/ });
    expect(tile.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^old\.png/ }));
    expect(onToggleSelect).toHaveBeenCalledWith("b");
  });
});
