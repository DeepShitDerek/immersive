"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/utils";
import { isIsoDate } from "../domain/dates";
import {
  parsePrices,
  recentPrices,
  type Price,
  type Security,
} from "../domain/invest";
import {
  useDeletePriceMutation,
  useSavePricesMutation,
} from "../data/money-api";
import { useMoney } from "./money-context";
import {
  ASSET_CLASS_LABEL,
  REGION_LABEL,
  SecuritySheet,
} from "./security-sheet";
import { DiscoverQuotesButton } from "./discover-quotes";

/**
 * The securities held, and their prices. Prices are typed in or
 * pasted from a spreadsheet or the broker — no price feed, so nothing about
 * the portfolio leaves the browser. The one exception is opt-in, per click:
 * today's quotes for securities already on the Discover watchlist.
 */
export function PricesPanel() {
  const { securities, securityById, prices, priceBook, today, settings } =
    useMoney();
  const [save, saving] = useSavePricesMutation();
  const [remove] = useDeletePriceMutation();
  const [editing, setEditing] = useState<Security | "new" | null>(null);
  const [securityId, setSecurityId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [price, setPrice] = useState("");
  const [paste, setPaste] = useState("");

  const bySymbol = useMemo(
    () => new Map(securities.map((x) => [x.symbol, x])),
    [securities],
  );
  const parsed = useMemo(
    () => (paste.trim() ? parsePrices(paste) : null),
    [paste],
  );
  const resolved = useMemo(() => {
    if (!parsed) return null;
    const prices: Price[] = [];
    const errors = [...parsed.errors];
    for (const p of parsed.prices) {
      const security = p.symbol
        ? bySymbol.get(p.symbol)
        : securityId
          ? securityById.get(securityId)
          : undefined;
      if (!security) {
        errors.push(
          p.symbol
            ? `Line ${p.line}: no security ${p.symbol} — add it first.`
            : `Line ${p.line}: no symbol — choose the security above for lines without one.`,
        );
        continue;
      }
      if (p.date > today) {
        errors.push(`Line ${p.line}: ${p.date} is in the future.`);
        continue;
      }
      prices.push({ securityId: security.id, date: p.date, price: p.price });
    }
    // One price per security per day: the last line wins.
    const unique = new Map(prices.map((p) => [`${p.securityId}|${p.date}`, p]));
    return { prices: [...unique.values()], errors };
  }, [parsed, bySymbol, securityById, securityId, today]);

  const addOne = async (event: FormEvent) => {
    event.preventDefault();
    const value = Number(price.replace(/,/g, ""));
    if (!securityId) return toast.error("Choose the security.");
    if (!isIsoDate(date) || date > today)
      return toast.error("Choose a date up to today.");
    if (!Number.isFinite(value) || value <= 0)
      return toast.error("The price has to be a number above zero.");
    try {
      await save([{ securityId, date, price: value }]).unwrap();
      setPrice("");
      toast.success(
        `${securityById.get(securityId)?.symbol} ${value} on ${date}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // A mistyped price skews every valuation after its date, so it can be taken out.
  const recorded = useMemo(
    () => (securityId ? recentPrices(prices, securityId, 12) : []),
    [prices, securityId],
  );
  const removePrice = async (entry: Price) => {
    try {
      await remove({ securityId: entry.securityId, date: entry.date }).unwrap();
      toast.success(
        `Removed ${securityById.get(entry.securityId)?.symbol ?? "the"} price for ${entry.date}`,
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const savePaste = async () => {
    if (!resolved || resolved.prices.length === 0) return;
    try {
      await save(resolved.prices).unwrap();
      toast.success(
        `${resolved.prices.length} price${resolved.prices.length === 1 ? "" : "s"} saved`,
      );
      setPaste("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="securities-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3
            id="securities-heading"
            className="font-heading text-base font-semibold"
          >
            Securities
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <DiscoverQuotesButton
              securities={securities}
              baseCurrency={settings.baseCurrency}
              today={today}
            />
            <Button size="sm" onClick={() => setEditing("new")}>
              <Plus className="mr-2 size-4" /> Security
            </Button>
          </div>
        </div>
        {securities.length === 0 ? (
          <p className="rounded-surface border border-dashed p-6 text-center text-sm text-muted-foreground">
            Add each stock, ETF or fund you hold — XEQT, VFV, an index fund in
            India — then record its trades.
          </p>
        ) : (
          <ul className="divide-y rounded-surface border bg-card text-sm">
            {securities.map((x) => {
              const latest = priceBook.latest(x.id, today);
              return (
                <li key={x.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-secondary/40"
                    onClick={() => setEditing(x)}
                  >
                    <span className="w-24 shrink-0 font-medium">
                      {x.symbol}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{x.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {ASSET_CLASS_LABEL[x.assetClass]} ·{" "}
                        {REGION_LABEL[x.region]} · {x.currency}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      {latest ? (
                        <>
                          {latest.price}{" "}
                          <span className="block text-xs text-muted-foreground">
                            {latest.date}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          no price
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {securities.length > 0 && (
        <section
          aria-labelledby="prices-heading"
          className="space-y-3 rounded-surface border bg-card p-5"
        >
          <h3
            id="prices-heading"
            className="font-heading text-base font-semibold"
          >
            Prices
          </h3>
          <form
            onSubmit={addOne}
            className="flex flex-wrap items-end gap-3"
            noValidate
          >
            <div className="space-y-1">
              <Label htmlFor="price-security" className="text-xs">
                Security
              </Label>
              <Select
                value={securityId ?? undefined}
                onValueChange={setSecurityId}
              >
                <SelectTrigger id="price-security" className="w-40">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {securities.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="price-date" className="text-xs">
                Date
              </Label>
              <Input
                id="price-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={today}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="price-value" className="text-xs">
                Price per unit
              </Label>
              <Input
                id="price-value"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-32"
              />
            </div>
            <Button type="submit" variant="outline" disabled={saving.isLoading}>
              Save price
            </Button>
          </form>

          {recorded.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <h4 className="text-xs font-medium">
                Recorded for {securityById.get(securityId!)?.symbol}, newest
                first
              </h4>
              <ul className="divide-y rounded-surface border text-sm">
                {recorded.map((entry) => (
                  <li
                    key={entry.date}
                    className="flex items-center gap-3 px-3 py-1"
                  >
                    <span className="flex-1 text-muted-foreground">
                      {entry.date}
                    </span>
                    <span className="tabular-nums">{entry.price}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove the price for ${entry.date}`}
                      onClick={() => removePrice(entry)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-1.5 pt-2">
            <Label htmlFor="price-paste">
              Or paste many — one per line: <code>symbol, date, price</code> (or{" "}
              <code>date, price</code> for the security chosen above)
            </Label>
            <Textarea
              id="price-paste"
              rows={4}
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"XEQT, 2026-09-23, 34.12\nVFV, 2026-09-23, 152.40"}
              className="font-mono text-xs"
            />
          </div>
          {resolved && (
            <div className="space-y-2 text-sm">
              {resolved.errors.length > 0 && (
                <ul role="alert" className="space-y-0.5 text-destructive">
                  {resolved.errors.slice(0, 8).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                  {resolved.errors.length > 8 && (
                    <li>…and {resolved.errors.length - 8} more.</li>
                  )}
                </ul>
              )}
              <Button
                onClick={savePaste}
                disabled={resolved.prices.length === 0 || saving.isLoading}
              >
                Save {resolved.prices.length} price
                {resolved.prices.length === 1 ? "" : "s"}
              </Button>
            </div>
          )}
        </section>
      )}
      <SecuritySheet
        security={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      />
    </div>
  );
}
