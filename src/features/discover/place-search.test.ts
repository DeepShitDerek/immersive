import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/geocoding.json";
import { parsePlaces, placeSearchUrl } from "./sources";

describe("place search", () => {
  it("asks Open-Meteo by name, trimmed and encoded", () => {
    const url = new URL(placeSearchUrl("  São Paulo "));
    expect(url.origin).toBe("https://geocoding-api.open-meteo.com");
    expect(url.searchParams.get("name")).toBe("São Paulo");
    expect(url.searchParams.get("count")).toBe("5");
  });

  it("keeps results with coordinates, with the region and country to tell them apart", () => {
    expect(parsePlaces(fixture)).toEqual([
      {
        id: 1275339,
        name: "Mumbai",
        where: "Maharashtra, India",
        latitude: 19.07283,
        longitude: 72.88261,
        timezone: "Asia/Kolkata",
      },
      {
        id: 6058560,
        name: "London",
        where: "Ontario, Canada",
        latitude: 42.98339,
        longitude: -81.23304,
        timezone: "America/Toronto",
      },
    ]);
  });

  it("reads nothing found, or a failed request, as no matches", () => {
    expect(parsePlaces({ generationtime_ms: 0.1 })).toEqual([]);
    expect(parsePlaces(null)).toEqual([]);
  });
});
