import { describe, expect, it } from "vitest";
import {
  isInternalUrl,
  markdownUrlTransform,
  safeImageUrl,
  safeLinkUrl,
} from "./safe-url";

describe("safeLinkUrl", () => {
  it.each([
    "https://example.com/a?b=c",
    "http://example.com",
    "mailto:me@example.com",
    "tel:+15551234567",
    "/about",
    "#contact",
  ])("allows %s", (url) => {
    expect(safeLinkUrl(url)).toBe(url);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    " javascript:alert(1)",
    "\u0000javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "vbscript:msgbox",
    "//attacker.example",
    "example.com",
  ])("rejects %j", (url) => {
    expect(safeLinkUrl(url)).toBeNull();
  });

  it("treats empty input as no link", () => {
    expect(safeLinkUrl("")).toBeNull();
    expect(safeLinkUrl(null)).toBeNull();
    expect(safeLinkUrl("   ")).toBeNull();
  });
});

describe("safeImageUrl", () => {
  it("allows http(s) and root-relative paths", () => {
    expect(safeImageUrl("https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );
    expect(safeImageUrl("/og.png")).toBe("/og.png");
  });

  it("rejects data:, blob: and mailto: — an SVG data URI can script", () => {
    expect(safeImageUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBeNull();
    expect(safeImageUrl("blob:https://example.com/x")).toBeNull();
    expect(safeImageUrl("mailto:a@b.c")).toBeNull();
  });
});

describe("helpers", () => {
  it("markdownUrlTransform blanks unsafe links", () => {
    expect(markdownUrlTransform("javascript:alert(1)")).toBe("");
    expect(markdownUrlTransform("/blog")).toBe("/blog");
  });

  it("isInternalUrl only for same-origin paths", () => {
    expect(isInternalUrl("/x")).toBe(true);
    expect(isInternalUrl("#x")).toBe(true);
    expect(isInternalUrl("https://x.dev")).toBe(false);
  });
});
