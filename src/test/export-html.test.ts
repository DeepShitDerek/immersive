import { describe, expect, it } from "vitest";
import {
  CREDIT_URL,
  hasCredit,
  takesCredit,
  withCredit,
} from "../../scripts/lib/export-html.mjs";

const page = (body: string) =>
  `<!DOCTYPE html><html><head><title>x</title></head><body>${body}</body></html>`;

describe("the Foliokit credit", () => {
  it("points at Foliokit's own repository", () => {
    expect(CREDIT_URL).toBe("https://github.com/akshay-bharadva/foliokit");
  });

  it("is added at the end of a page's body", () => {
    const html = withCredit(page("<main>Hello</main>"));
    expect(hasCredit(html)).toBe(true);
    expect(html).toContain(`href="${CREDIT_URL}"`);
    expect(html).toContain("Built with");
    // After the page's own content, before the body closes.
    expect(html.indexOf("data-fk")).toBeGreaterThan(html.indexOf("</main>"));
    expect(html.indexOf("data-fk")).toBeLessThan(html.lastIndexOf("</body>"));
  });

  it("is added once, however many times the build step runs", () => {
    const once = withCredit(page("<main>Hello</main>"));
    expect(withCredit(once)).toBe(once);
    expect(once.match(/data-fk/g)).toHaveLength(1);
  });

  it("is not fooled by a page that only mentions the name", () => {
    const html = page("<main>Built with Foliokit, they said.</main>");
    expect(hasCredit(html)).toBe(false);
    expect(hasCredit(withCredit(html))).toBe(true);
  });

  it("goes before the last closing body tag, not one quoted in the page", () => {
    const html = withCredit(page("<pre>&lt;/body&gt; </body ></pre>x"));
    expect(html.endsWith("</body></html>")).toBe(true);
    expect(html.indexOf("data-fk")).toBeGreaterThan(html.indexOf("</pre>"));
  });

  it("leaves a file with no body alone", () => {
    expect(withCredit("<svg></svg>")).toBe("<svg></svg>");
  });

  it("opens the repository without handing it the visitor's page", () => {
    const html = withCredit(page(""));
    expect(html).toMatch(/rel="noopener"/);
  });

  it.each([
    ["index.html", true],
    ["about/index.html", true],
    ["blog/a-post/index.html", true],
    ["404.html", true],
    ["admin/index.html", false],
    ["admin/tasks/index.html", false],
    ["dev/money/index.html", false],
    ["administration/index.html", true],
  ])("%s takes the credit: %s", (file, expected) => {
    // The private workspace and the test harness are not the public site.
    expect(takesCredit(file)).toBe(expected);
    expect(takesCredit(file.replace(/\//g, "\\"))).toBe(expected);
  });
});
