import { describe, expect, it } from "vitest";
import { footerLinks, samePath, splitNav } from "./nav-links";

const nav = [
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  { label: "Writing", href: "/blog" },
  { label: "Work with me", href: "/contact" },
];

describe("splitNav", () => {
  it("pulls the contact link out as the call to action, keeping its label", () => {
    const { items, cta } = splitNav(nav);
    expect(cta).toEqual({ label: "Work with me", href: "/contact" });
    expect(items.map((link) => link.href)).toEqual([
      "/work",
      "/about",
      "/blog",
    ]);
  });

  it("matches the contact page with or without a trailing slash", () => {
    expect(splitNav([{ label: "Hi", href: "/contact/" }]).cta?.label).toBe(
      "Hi",
    );
  });

  it("has no call to action when the nav has no contact link", () => {
    const { items, cta } = splitNav(nav.slice(0, 3));
    expect(cta).toBeUndefined();
    expect(items).toHaveLength(3);
  });
});

describe("footerLinks", () => {
  it("adds footer-only links after the nav", () => {
    const links = footerLinks(nav, [{ label: "Updates", href: "/updates" }]);
    expect(links.map((link) => link.label)).toEqual([
      "Work",
      "About",
      "Writing",
      "Work with me",
      "Updates",
    ]);
  });

  it("never lists a page twice", () => {
    const links = footerLinks(nav, [{ label: "Blog", href: "/blog/" }]);
    expect(links).toHaveLength(4);
  });

  it("copes with no extras", () => {
    expect(footerLinks(nav, undefined)).toEqual(nav);
  });
});

describe("samePath", () => {
  it("ignores trailing slashes, queries and hashes", () => {
    expect(samePath("/blog/", "/blog")).toBe(true);
    expect(samePath("/blog?tag=x", "/blog")).toBe(true);
    expect(samePath("/", "/")).toBe(true);
    expect(samePath("/work", "/about")).toBe(false);
  });
});
