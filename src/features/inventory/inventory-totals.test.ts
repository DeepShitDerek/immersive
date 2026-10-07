import { describe, expect, it } from "vitest";
import type { InventoryItem } from "@/types";
import { totals } from "./inventory-filters";
import { formatValue, itemCurrency } from "./item-value";

const item = (fields: Partial<InventoryItem>) =>
  ({ id: "x", name: "x", ...fields }) as InventoryItem;

describe("inventory money is kept per currency", () => {
  it("never adds rupees to dollars, and leads with the base currency", () => {
    const result = totals(
      [
        item({ purchase_price: 2000, current_value: 1500 }), // no currency: base
        item({
          purchase_price: 100,
          current_value: 120,
          currency: "CAD",
          quantity: 2,
        }),
        item({ purchase_price: 90000, current_value: 60000, currency: "INR" }),
      ],
      "CAD",
    );
    expect(result.units).toBe(4);
    expect(result.byCurrency).toEqual([
      // Worth 1500 + 2×120, paid 2000 + 2×100.
      { currency: "CAD", paid: 2200, worth: 1740, depreciation: 460 },
      { currency: "INR", paid: 90000, worth: 60000, depreciation: 30000 },
    ]);
  });

  it("an item with no currency is in the base currency, and shows its symbol", () => {
    expect(itemCurrency(item({}), "USD")).toBe("USD");
    expect(itemCurrency(item({ currency: "EUR" }), "USD")).toBe("EUR");
    expect(formatValue(1234.5, "CAD")).toMatch(/\$1,234\.50/);
  });
});
