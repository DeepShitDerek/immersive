import { describe, expect, it } from "vitest";
import { mostReadSource, parseTopArticles } from "./sources";

// Thursday 8 October 2026, local time.
const NOW = new Date(2026, 9, 8, 15, 0);

describe("most read, by window", () => {
  it("uses the daily feed for 24 hours", () => {
    const { urls, label } = mostReadSource("day", NOW);
    expect(urls).toEqual([
      "https://api.wikimedia.org/feed/v1/wikipedia/en/featured/2026/10/07",
    ]);
    expect(label).toBe("Wikipedia, yesterday");
  });

  it("asks for the seven complete days before today for a week", () => {
    const { urls } = mostReadSource("week", NOW);
    expect(urls).toHaveLength(7);
    expect(urls[0]).toMatch(/\/top\/en\.wikipedia\/all-access\/2026\/10\/07$/);
    expect(urls[6]).toMatch(/\/2026\/10\/01$/);
  });

  it("asks for the last full month, and names it", () => {
    const { urls, label } = mostReadSource("month", NOW);
    expect(urls).toEqual([
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/2026/09/all-days",
    ]);
    expect(label).toBe("Wikipedia, September 2026 (the last full month)");
  });

  it("sums views across days, drops non-articles, and reads titles", () => {
    const day = (articles: [string, number][]) => ({
      items: [
        { articles: articles.map(([article, views]) => ({ article, views })) },
      ],
    });
    const result = parseTopArticles([
      day([
        ["Main_Page", 9e6],
        ["Special:Search", 8e6],
        ["Lizzie_Borden", 100],
        ["Rust_(programming_language)", 80],
      ]),
      day([
        ["Rust_(programming_language)", 90],
        ["Wikipedia:Featured_pictures", 7e6],
      ]),
      null,
    ]);
    expect(result).toEqual([
      {
        title: "Rust (programming language)",
        views: 170,
        url: "https://en.wikipedia.org/wiki/Rust_(programming_language)",
      },
      {
        title: "Lizzie Borden",
        views: 100,
        url: "https://en.wikipedia.org/wiki/Lizzie_Borden",
      },
    ]);
  });
});
