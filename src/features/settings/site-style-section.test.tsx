import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";

vi.mock("@/features/immersive/styles/fonts", () => ({
  immersiveFontVars: "fonts",
}));

import { SiteStyleSection } from "./site-style-section";
import { SETTINGS_SECTIONS } from "./settings-groups";

let current: () => unknown;

function Harness({ initial }: { initial: unknown }) {
  const form = useForm({
    defaultValues: { profile_data: { site_style: initial } },
  });
  current = () => form.getValues("profile_data.site_style");
  return (
    <Form {...form}>
      <SiteStyleSection form={form as never} />
    </Form>
  );
}

const radio = (name: RegExp) =>
  screen.getByRole("radio", { name }) as HTMLInputElement;

afterEach(cleanup);

describe("SiteStyleSection", () => {
  it("offers the four styles as one radio group", () => {
    render(<Harness initial="classic" />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual([
      "classic",
      "noir",
      "paper",
      "dusk",
    ]);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radio(/Classic/).checked).toBe(true);
  });

  it("selects Classic for a value that is not a style", () => {
    render(<Harness initial="neon" />);
    expect(radio(/Classic/).checked).toBe(true);
  });

  it("writes the chosen style to the form", () => {
    render(<Harness initial="classic" />);
    fireEvent.click(radio(/Dusk/));
    expect(current()).toBe("dusk");
  });

  it("says when visitors will see the change", () => {
    render(<Harness initial="classic" />);
    expect(screen.getByText(/Publish site/)).not.toBeNull();
  });
});

describe("settings groups", () => {
  it("has a Site style group under Appearance that saves site_style", () => {
    const appearance = SETTINGS_SECTIONS.find((s) => s.id === "appearance")!;
    const group = appearance.groups.find((g) => g.id === "site-style")!;
    expect(group.fields).toEqual(["profile_data.site_style"]);
    expect(group.preview).toBe("home");
  });
});
