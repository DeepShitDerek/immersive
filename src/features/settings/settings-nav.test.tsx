import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsGroupSwitcher } from "./settings-nav";
import { DEFAULT_GROUP_ID } from "./settings-groups";

describe("SettingsGroupSwitcher", () => {
  it("names the group on screen, and says when it has unsaved changes", () => {
    render(
      <SettingsGroupSwitcher
        activeId={DEFAULT_GROUP_ID}
        onSelect={vi.fn()}
        dirtyIds={new Set([DEFAULT_GROUP_ID])}
        invalidIds={new Set()}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Settings group" }),
    ).toHaveTextContent("Brand & logo · unsaved");
  });

  it("puts errors ahead of unsaved", () => {
    render(
      <SettingsGroupSwitcher
        activeId={DEFAULT_GROUP_ID}
        onSelect={vi.fn()}
        dirtyIds={new Set([DEFAULT_GROUP_ID])}
        invalidIds={new Set([DEFAULT_GROUP_ID])}
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "Settings group" }),
    ).toHaveTextContent("Brand & logo · has errors");
  });
});
