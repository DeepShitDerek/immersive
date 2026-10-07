import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_KINDS,
  REGISTRATIONS,
  TRANSACTION_KINDS,
} from "./domain/ledger";
import { exponentOf } from "./domain/money";
import { ALL_CURRENCIES, PROVINCES } from "./ui/labels";

/**
 * The TypeScript copies of database facts — currency exponents, the
 * currency list, enum values, provinces — checked against db/schema.sql
 * itself, so a change to one side without the other fails here instead of
 * as a wrong amount or a refused insert in production.
 */

const sql = readFileSync(
  path.resolve(__dirname, "../../../db/schema.sql"),
  "utf8",
);

function enumValues(name: string): string[] {
  const match = new RegExp(
    `CREATE TYPE ${name} AS ENUM\\s*\\(([^)]*)\\)`,
    "i",
  ).exec(sql);
  if (!match) throw new Error(`enum ${name} not found`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("money schema parity", () => {
  const seed =
    /INSERT INTO money_currency \(code, exponent, name, symbol\) VALUES([\s\S]*?)ON CONFLICT/.exec(
      sql,
    )?.[1] ?? "";
  const currencies = [...seed.matchAll(/\('([A-Z]{3})', (\d)/g)].map((m) => ({
    code: m[1],
    exponent: Number(m[2]),
  }));

  it("finds the currency seed", () => {
    expect(currencies.length).toBeGreaterThan(30);
  });

  it("uses the database's exponent for every seeded currency", () => {
    for (const { code, exponent } of currencies)
      expect(exponentOf(code), code).toBe(exponent);
  });

  it("offers exactly the seeded currencies in pickers", () => {
    expect([...ALL_CURRENCIES].sort()).toEqual(
      currencies.map((c) => c.code).sort(),
    );
  });

  it("mirrors the enums", () => {
    expect(enumValues("money_account_kind")).toEqual([...ACCOUNT_KINDS]);
    expect(enumValues("money_registration")).toEqual([...REGISTRATIONS]);
    expect(enumValues("money_transaction_kind")).toEqual([
      ...TRANSACTION_KINDS,
    ]);
  });

  it("offers exactly the provinces the settings CHECK allows", () => {
    const allowed = /province IN\s*\(([^)]*)\)/.exec(sql)?.[1] ?? "";
    expect(PROVINCES.map((p) => p.code).sort()).toEqual(
      [...allowed.matchAll(/'([A-Z]{2})'/g)].map((m) => m[1]).sort(),
    );
  });
});
