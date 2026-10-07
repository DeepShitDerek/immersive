import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RichMarkdown } from "./rich-markdown";

afterEach(cleanup);

const FENCE = "```ts\nconst answer = 42;\n```";

describe("RichMarkdown code blocks", () => {
  it("can be reached and scrolled with the keyboard", () => {
    // A long line makes the block scroll sideways. Without a tab stop a
    // keyboard user cannot scroll it (WCAG 2.1.1; axe: scrollable-region-focusable).
    const { container } = render(<RichMarkdown>{FENCE}</RichMarkdown>);
    const pre = container.querySelector("pre")!;
    expect(pre.getAttribute("tabindex")).toBe("0");
    expect(pre.textContent).toContain("const answer = 42;");
  });

  it("keeps the highlighting class and a caller's own components", () => {
    const { container } = render(
      <RichMarkdown
        components={{ a: (props) => <a data-own {...props} /> }}
      >{`${FENCE}\n\n[link](https://example.com/)`}</RichMarkdown>,
    );
    expect(container.querySelector("pre")!.className).toContain("language-ts");
    expect(container.querySelector("a[data-own]")).not.toBeNull();
  });

  it("lets a caller replace the code block", () => {
    const { container } = render(
      <RichMarkdown components={{ pre: () => <pre data-own /> }}>
        {FENCE}
      </RichMarkdown>,
    );
    expect(container.querySelector("pre[data-own]")).not.toBeNull();
  });
});
