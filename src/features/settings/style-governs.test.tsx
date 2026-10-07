import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SETTINGS_SECTIONS, groupUnderStyle } from "./settings-groups";
import { StyleGovernsNotice } from "./style-governs-notice";

const group = (id: string) =>
  SETTINGS_SECTIONS.flatMap((section) => section.groups).find(
    (g) => g.id === id,
  )!;

afterEach(cleanup);

describe("groupUnderStyle", () => {
  it("leaves every group as it is under Classic", () => {
    for (const g of SETTINGS_SECTIONS.flatMap((section) => section.groups)) {
      expect(groupUnderStyle(g, "classic")).toEqual({
        preview: g.preview,
        governed: false,
      });
    }
  });

  it.each(["noir", "paper", "dusk"] as const)(
    "under %s, Theme and Typography have no effect and no preview",
    (style) => {
      for (const id of ["theme", "typography"]) {
        expect(groupUnderStyle(group(id), style)).toEqual({
          preview: null,
          governed: true,
        });
      }
    },
  );

  it("leaves the other groups previewable under an immersive style", () => {
    expect(groupUnderStyle(group("site-style"), "noir")).toEqual({
      preview: "home",
      governed: false,
    });
    expect(groupUnderStyle(group("brand"), "dusk").governed).toBe(false);
    expect(groupUnderStyle(group("brand"), "dusk").preview).toBe(
      group("brand").preview,
    );
  });

  it("treats an unknown style as Classic", () => {
    expect(groupUnderStyle(group("theme"), "neon" as never)).toEqual({
      preview: group("theme").preview,
      governed: false,
    });
  });
});

describe("StyleGovernsNotice", () => {
  it("names the style in charge and what the setting still does", () => {
    render(<StyleGovernsNotice style="paper" setting="Theme" />);
    const note = screen.getByRole("note");
    expect(note.textContent).toContain("Paper");
    // Site and workspace both follow the style now, so the setting is idle.
    expect(note.textContent).toMatch(/no effect/i);
    expect(note.textContent).toMatch(/Classic/);
    expect(note.textContent).toContain("Theme");
  });

  it("renders nothing under Classic", () => {
    const { container } = render(
      <StyleGovernsNotice style="classic" setting="Theme" />,
    );
    expect(container.innerHTML).toBe("");
  });
});
