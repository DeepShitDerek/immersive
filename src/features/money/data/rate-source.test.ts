import { describe, expect, it, vi } from "vitest";
import { fetchLatest, fetchSeries } from "./rate-source";

const reply = (body: unknown, ok = true) =>
  vi.fn(
    async () =>
      ({
        ok,
        status: ok ? 200 : 503,
        json: async () => body,
      }) as unknown as Response,
  );

describe("rate source", () => {
  it("reads the latest snapshot and asks only for published currencies", async () => {
    const fetchImpl = reply({
      date: "2026-02-06",
      rates: { INR: 61.2, USD: 0.74 },
    });
    const rows = await fetchLatest("CAD", ["INR", "USD", "AED", "CAD"], {
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("symbols=INR,USD"),
      expect.anything(),
    );
    expect(rows).toEqual([
      { base: "CAD", quote: "INR", asOf: "2026-02-06", rate: 61.2 },
      { base: "CAD", quote: "USD", asOf: "2026-02-06", rate: 0.74 },
    ]);
  });

  it("drops malformed values instead of storing them", async () => {
    const fetchImpl = reply({
      date: "2026-02-06",
      rates: { INR: "abc", USD: -1, EUR: 0.68, lower: 2 },
    });
    expect(
      await fetchLatest("CAD", ["INR", "USD", "EUR"], { fetchImpl }),
    ).toEqual([{ base: "CAD", quote: "EUR", asOf: "2026-02-06", rate: 0.68 }]);
    expect(
      await fetchLatest("CAD", ["INR"], {
        fetchImpl: reply({ rates: { INR: 61 } }),
      }),
    ).toEqual([]);
  });

  it("reads a series in date order and skips bad dates", async () => {
    const fetchImpl = reply({
      rates: {
        "2026-02-06": { INR: 61 },
        "2026-02-05": { INR: 60.5 },
        "2026-13-01": { INR: 1 },
      },
    });
    expect(
      (await fetchSeries("CAD", ["INR"], "2026-02-01", { fetchImpl })).map(
        (r) => r.asOf,
      ),
    ).toEqual(["2026-02-05", "2026-02-06"]);
  });

  it("makes no request when nothing can be priced, and throws on an HTTP error", async () => {
    const fetchImpl = reply({});
    expect(await fetchLatest("AED", ["INR"], { fetchImpl })).toEqual([]);
    expect(await fetchLatest("CAD", ["AED"], { fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(
      fetchLatest("CAD", ["INR"], { fetchImpl: reply({}, false) }),
    ).rejects.toThrow(/503/);
  });
});
