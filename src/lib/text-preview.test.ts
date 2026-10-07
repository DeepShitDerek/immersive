import { describe, expect, it } from "vitest";
import { plainPreview } from "./text-preview";

describe("plainPreview", () => {
  it("keeps link text and drops the URL", () => {
    expect(
      plainPreview(
        "Local AI.\n\n[View Source on GitHub](https://github.com/x)",
      ),
    ).toBe("Local AI. View Source on GitHub");
  });

  it("strips headings, lists, emphasis, quotes and code", () => {
    expect(
      plainPreview(
        "## Title\n- **bold** item\n> quoted `code`\n```js\nx()\n```",
      ),
    ).toBe("Title bold item quoted code");
  });

  it("copes with nothing", () => {
    expect(plainPreview(null)).toBe("");
    expect(plainPreview("   ")).toBe("");
  });
});
