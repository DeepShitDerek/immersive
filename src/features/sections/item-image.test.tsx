import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemImage } from "./shared";

/** Pretend every <img> is in the given load state when React attaches. */
function imagesAre(state: { complete: boolean; naturalWidth: number }) {
  vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(
    state.complete,
  );
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(
    state.naturalWidth,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ItemImage", () => {
  it("hides an image that already failed before React attached", () => {
    // What a prerendered <img> with a dead URL looks like at hydration:
    // finished, with no pixels. onError has already fired and been missed.
    imagesAre({ complete: true, naturalWidth: 0 });
    const { container } = render(
      <ItemImage src="https://cdn.invalid.example/x.png" alt="" />,
    );
    expect(container.querySelector("img")!.style.visibility).toBe("hidden");
  });

  it("leaves a loaded image alone", () => {
    imagesAre({ complete: true, naturalWidth: 800 });
    const { container } = render(
      <ItemImage src="https://cdn.example/x.png" alt="" />,
    );
    expect(container.querySelector("img")!.style.visibility).toBe("");
  });

  it("leaves an image that is still loading to onError", () => {
    imagesAre({ complete: false, naturalWidth: 0 });
    const { container } = render(
      <ItemImage src="https://cdn.example/x.png" alt="" />,
    );
    expect(container.querySelector("img")!.style.visibility).toBe("");
  });

  it("renders the placeholder, not an <img>, for an unsafe URL", () => {
    const { container } = render(
      <ItemImage src="javascript:alert(1)" alt="" fallbackLabel="A" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("A");
  });
});
