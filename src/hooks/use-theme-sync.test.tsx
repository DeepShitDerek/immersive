import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { SiteContent } from "@/types";
import { normalizeSiteContent } from "@/lib/site-identity";
import { useThemeSync } from "./use-theme-sync";

function Probe({ identity }: { identity: SiteContent | undefined }) {
  useThemeSync(identity);
  return null;
}

const withStyle = (site_style: unknown) =>
  normalizeSiteContent({ profile_data: { site_style } } as never);

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-style");
});

describe("useThemeSync and data-style", () => {
  it("writes the owner's style onto <html>", () => {
    render(<Probe identity={withStyle("paper")} />);
    expect(document.documentElement.dataset.style).toBe("paper");
  });

  it("writes classic for an unknown style", () => {
    render(<Probe identity={withStyle("neon")} />);
    expect(document.documentElement.dataset.style).toBe("classic");
  });

  it("follows a change", () => {
    const { rerender } = render(<Probe identity={withStyle("noir")} />);
    rerender(<Probe identity={withStyle("dusk")} />);
    expect(document.documentElement.dataset.style).toBe("dusk");
  });

  it("leaves the build's value alone until the identity arrives", () => {
    document.documentElement.dataset.style = "noir";
    render(<Probe identity={undefined} />);
    expect(document.documentElement.dataset.style).toBe("noir");
  });
});
