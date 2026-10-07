import { describe, expect, it } from "vitest";
import { sizedImageUrl } from "./image-size";

describe("sizedImageUrl", () => {
  it("asks github.com avatars for twice the display size", () => {
    expect(sizedImageUrl("https://github.com/octocat.png", 40)).toBe(
      "https://github.com/octocat.png?size=80",
    );
  });

  it("uses the avatar CDN's own parameter and keeps the others", () => {
    expect(
      sizedImageUrl("https://avatars.githubusercontent.com/u/1?v=4", 40),
    ).toBe("https://avatars.githubusercontent.com/u/1?v=4&s=80");
  });

  it("leaves every other URL alone", () => {
    expect(sizedImageUrl("https://images.unsplash.com/x.jpg", 40)).toBe(
      "https://images.unsplash.com/x.jpg",
    );
    expect(sizedImageUrl("https://github.com/org/repo.png", 40)).toBe(
      "https://github.com/org/repo.png",
    );
    expect(sizedImageUrl("/local.png", 40)).toBe("/local.png");
  });
});
