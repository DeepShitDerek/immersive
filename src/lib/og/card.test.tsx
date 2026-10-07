// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ identity: undefined as unknown }));
vi.mock("@/lib/public-data", () => ({
  fetchSiteIdentity: async () => state.identity,
  orUndefined: async <T,>(promise: Promise<T>) => {
    try {
      return await promise;
    } catch {
      return undefined;
    }
  },
}));

import { OG_SIZE, renderOgCard } from "./card";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function render(site_style: unknown, title = "A card title") {
  state.identity = { profile_data: { name: "Ada Lovelace", site_style } };
  const response = await renderOgCard({
    eyebrow: "Writing",
    title,
    description: "One or two sentences under the title, as a post has.",
  });
  return new Uint8Array(await response.arrayBuffer());
}

/** Width and height from the PNG's IHDR chunk. */
function size(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

afterEach(() => {
  state.identity = undefined;
});

describe("renderOgCard", () => {
  it.each(["classic", "noir", "paper", "dusk"])(
    "draws a full-size PNG for %s",
    async (style) => {
      const png = await render(style);
      expect([...png.slice(0, 8)]).toEqual(PNG);
      expect(size(png)).toEqual(OG_SIZE);
      expect(png.length).toBeGreaterThan(5000);
    },
    30_000,
  );

  it("draws each style differently", async () => {
    // One at a time: each render reads the identity set just before it.
    const cards: Uint8Array[] = [];
    for (const style of ["classic", "noir", "paper", "dusk"]) {
      cards.push(await render(style));
    }
    const distinct = new Set(
      cards.map((png) => Buffer.from(png).toString("base64")),
    );
    expect(distinct.size).toBe(4);
  }, 60_000);

  it("draws the Classic card for an unknown style, or with no identity", async () => {
    const classic = Buffer.from(await render("classic")).toString("base64");
    expect(Buffer.from(await render("neon")).toString("base64")).toBe(classic);
  }, 60_000);

  it("copes with a very long title in the uppercase style", async () => {
    const png = await render("noir", "word ".repeat(60));
    expect(size(png)).toEqual(OG_SIZE);
  }, 30_000);
});
