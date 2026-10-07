import { describe, expect, it } from "vitest";
import {
  add,
  allocate,
  convert,
  exponentOf,
  formatMoney,
  impliedRate,
  money,
  multiply,
  MoneyError,
  parseAmount,
  roundHalfAwayFromZero,
  subtract,
  sum,
  toInputString,
  toMajor,
} from "./money";

const cad = (minor: number) => money(minor, "CAD");

describe("money()", () => {
  it("holds whole minor units only", () => {
    expect(cad(1234)).toEqual({ minor: 1234, currency: "CAD" });
    expect(() => cad(12.5)).toThrow(MoneyError);
    expect(() => cad(Number.NaN)).toThrow(MoneyError);
    expect(() => cad(2 ** 53)).toThrow(MoneyError);
    expect(() => money(1, "cad")).toThrow(/currency code/);
  });

  it("never keeps a negative zero", () => {
    expect(Object.is(cad(-0).minor, 0)).toBe(true);
  });
});

describe("exponents mirror money_currency", () => {
  it.each([
    ["CAD", 2],
    ["INR", 2],
    ["JPY", 0],
    ["KRW", 0],
    ["VND", 0],
    ["KWD", 3],
    ["BHD", 3],
    ["OMR", 3],
  ])("%s has %i decimals", (code, exponent) => {
    expect(exponentOf(code)).toBe(exponent);
  });
});

describe("roundHalfAwayFromZero", () => {
  it.each([
    [2.5, 3],
    [-2.5, -3],
    [2.4999999, 2],
    [-2.4999999, -2],
    [1.005 * 100, 101], // binary noise on a written half
    // The double just below 0.5 is noise on a half, like 1.005 * 100.
    [0.49999999999999994, 1],
    [0.4999999999, 0],
    [123456789.49999, 123456789],
    [0, 0],
  ])("%d → %i", (input, expected) => {
    expect(roundHalfAwayFromZero(input)).toBe(expected);
  });

  it("keeps a charge and its refund exact negatives", () => {
    for (let i = 0; i < 2000; i += 1) {
      const value = (Math.random() - 0.5) * 1e7;
      expect(roundHalfAwayFromZero(-value)).toBe(
        -roundHalfAwayFromZero(value) + 0,
      );
    }
  });
});

describe("parseAmount", () => {
  it.each([
    ["12.34", "CAD", 1234],
    ["1,234.56", "CAD", 123456],
    ["-45", "CAD", -4500],
    ["−45.00", "CAD", -4500],
    ["(45.00)", "CAD", -4500],
    ["45.00-", "CAD", -4500],
    ["$1,000", "CAD", 100000],
    ["-$12.00", "CAD", -1200],
    ["CAD 12.00", "CAD", 1200],
    ["12.00 CAD", "CAD", 1200],
    ["₹ 1,00,000.50", "INR", 10000050],
    ["Rs.250 DR", "INR", -25000],
    ["Rs 250.00 Cr", "INR", 25000],
    ["1.005", "CAD", 101],
    ["1.004", "CAD", 100],
    [".5", "CAD", 50],
    ["1234", "JPY", 1234],
    ["1.2345", "KWD", 1235],
    [12.34, "CAD", 1234],
    [0.1 + 0.2, "CAD", 30],
    [1e-7, "CAD", 0],
  ])("%s %s → %i", (input, currency, minor) => {
    expect(parseAmount(input, currency).minor).toBe(minor);
  });

  it.each([
    "",
    "abc",
    "1e5",
    "12..3",
    "1.2.3",
    "$",
    "--5",
    "(-5)",
    "-5 DR",
    "+-5",
    "12 34x",
  ])('refuses "%s"', (input) => {
    expect(() => parseAmount(input, "CAD")).toThrow(MoneyError);
  });

  it("refuses amounts too large to hold exactly", () => {
    expect(() => parseAmount("999999999999999999", "CAD")).toThrow(/too large/);
  });

  it("round-trips through the input string", () => {
    for (const minor of [0, 1, -1, 5, 99, 100, 123456, -987654321]) {
      for (const currency of ["CAD", "JPY", "KWD"]) {
        const value = money(minor, currency);
        expect(parseAmount(toInputString(value), currency)).toEqual(value);
      }
    }
  });
});

describe("arithmetic", () => {
  it("adds and subtracts within one currency only", () => {
    expect(add(cad(100), cad(250))).toEqual(cad(350));
    expect(subtract(cad(100), cad(250))).toEqual(cad(-150));
    expect(() => add(cad(1), money(1, "INR"))).toThrow(/convert/);
  });

  it("sums, refusing a foreign amount rather than mixing it in", () => {
    expect(sum([cad(1), cad(2), cad(3)], "CAD")).toEqual(cad(6));
    expect(sum([], "CAD")).toEqual(cad(0));
    expect(() => sum([cad(1), money(1, "INR")], "CAD")).toThrow(MoneyError);
  });

  it("multiplies by a ratio and rounds once", () => {
    expect(multiply(cad(1999), 0.13)).toEqual(cad(260)); // 259.87
    expect(multiply(cad(-1999), 0.13)).toEqual(cad(-260));
  });
});

describe("allocate", () => {
  it("never loses or invents a unit", () => {
    for (let trial = 0; trial < 500; trial += 1) {
      const minor = Math.floor((Math.random() - 0.3) * 1e8);
      const weights = Array.from(
        { length: 1 + Math.floor(Math.random() * 7) },
        () => Math.floor(Math.random() * 100),
      );
      if (!weights.some((w) => w > 0)) weights[0] = 1;
      const parts = allocate(cad(minor), weights);
      expect(parts.reduce((total, part) => total + part.minor, 0)).toBe(minor);
      parts.forEach((part, i) => {
        if (weights[i] === 0) expect(part.minor).toBe(0);
      });
    }
  });

  it("splits $10.00 three ways as 3.34 / 3.33 / 3.33", () => {
    expect(allocate(cad(1000), [1, 1, 1]).map((p) => p.minor)).toEqual([
      334, 333, 333,
    ]);
  });

  it("refuses nonsense weights", () => {
    expect(() => allocate(cad(100), [])).toThrow();
    expect(() => allocate(cad(100), [0, 0])).toThrow();
    expect(() => allocate(cad(100), [1, -1])).toThrow();
  });
});

describe("conversion", () => {
  it("crosses exponents", () => {
    expect(convert(cad(100000), 61.25, "INR")).toEqual(money(6125000, "INR"));
    expect(convert(money(100, "JPY"), 0.0091, "CAD")).toEqual(cad(91));
    expect(convert(cad(100), 0.3, "KWD")).toEqual(money(300, "KWD"));
    expect(convert(cad(123), 1, "CAD")).toEqual(cad(123));
  });

  it("refuses a nonsense rate", () => {
    expect(() => convert(cad(1), 0, "INR")).toThrow();
    expect(() => convert(cad(1), -2, "INR")).toThrow();
    expect(() => convert(cad(1), Number.NaN, "INR")).toThrow();
  });

  it("recovers the rate a remittance delivered", () => {
    expect(impliedRate(cad(-100000), money(6000000, "INR"))).toBeCloseTo(
      60,
      10,
    );
    expect(impliedRate(money(10000, "JPY"), cad(9100))).toBeCloseTo(0.0091, 10);
    expect(() => impliedRate(cad(0), money(1, "INR"))).toThrow();
  });
});

describe("display", () => {
  it("formats with the currency's own precision", () => {
    expect(formatMoney(cad(123456))).toBe("$1,234.56");
    expect(formatMoney(cad(-4500))).toBe("−$45.00");
    expect(formatMoney(money(1234, "JPY"))).toBe("¥1,234");
    expect(formatMoney(money(1234, "KWD"))).toContain("1.234");
  });

  it("groups rupees the Indian way", () => {
    expect(formatMoney(money(10000000, "INR"))).toBe("₹1,00,000.00");
  });

  it("signs, trims and compacts on request", () => {
    expect(formatMoney(cad(1200), { signed: true })).toBe("+$12.00");
    expect(formatMoney(cad(0), { signed: true })).toBe("$0.00");
    expect(formatMoney(cad(120000), { trimZeros: true })).toBe("$1,200");
    expect(formatMoney(cad(123456789), { compact: true })).toBe("$1.2M");
  });

  it("exposes a major-unit number for charts only", () => {
    expect(toMajor(cad(1234))).toBe(12.34);
    expect(toMajor(money(1234, "KWD"))).toBe(1.234);
  });
});
