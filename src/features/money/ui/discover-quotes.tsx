"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import {
  useGetIntegrationSettingsQuery,
  useGetWatchlistQuery,
} from "@/store/api/adminApi";
import { fetchQuotes } from "@/features/discover/quotes";
import { fetchJson } from "@/features/discover/sources";
import type { Security } from "../domain/invest";
import { pricesFromQuotes, watchedSecurities } from "../domain/quote-prices";
import { useSavePricesMutation } from "../data/money-api";

/**
 * "Today's prices from Discover": opt-in, one click at a time.
 *
 * Only for held securities already on the Discover watchlist, whose symbols
 * the owner already sends to a quote provider. It asks first, every time, and
 * says what leaves the browser. Holdings, quantities and accounts never do.
 * Nothing runs on its own: Money stays feed-free unless this is pressed.
 */
export function DiscoverQuotesButton({
  securities,
  baseCurrency,
  today,
}: {
  securities: readonly Security[];
  baseCurrency: string;
  today: string;
}) {
  const confirm = useConfirm();
  const { data: watchlist = [] } = useGetWatchlistQuery();
  const { data: integrations } = useGetIntegrationSettingsQuery();
  const [save] = useSavePricesMutation();
  const [busy, setBusy] = useState(false);

  const watched = watchedSecurities(
    securities,
    watchlist.map((e) => e.symbol),
  );
  if (watched.length === 0) return null;

  const run = async () => {
    const symbols = watched.map((s) => s.symbol).join(", ");
    const provider = integrations?.market_data_provider ?? null;
    const ok = await confirm({
      title: "Fetch today's prices from Discover?",
      description: `This sends ${symbols} to ${provider ? `your quote provider (${provider}) and CoinGecko` : "CoinGecko (crypto only; no stock key is set)"}, the same as the Discover watchlist does. Nothing about your holdings, quantities or accounts is sent. Prices come back in the listing's own currency; any that don't match the security's currency are skipped, not converted.`,
      confirmText: "Fetch prices",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const entries = watchlist.filter((e) =>
        watched.some(
          (s) =>
            s.symbol.trim().toUpperCase() === e.symbol.trim().toUpperCase(),
        ),
      );
      const quotes = await fetchQuotes(entries, {
        baseCurrency,
        provider,
        key: integrations?.market_data_key ?? null,
        fetchJson,
      });
      const byId = new Map(entries.map((e) => [e.id, e]));
      const { prices, skipped } = pricesFromQuotes(
        securities,
        quotes.map((q) => ({
          symbol: byId.get(q.entryId)?.symbol ?? "",
          price: q.price,
          currency: q.currency ?? byId.get(q.entryId)?.currency ?? null,
        })),
        today,
      );
      if (prices.length > 0) await save(prices).unwrap();
      const missing = watched.length - prices.length - skipped.length;
      const notes = [
        ...skipped.map((s) => `${s.symbol}: ${s.reason}`),
        ...(missing > 0 ? [`${missing} without a quote`] : []),
      ];
      if (prices.length > 0) {
        toast.success(
          `${prices.length} price${prices.length === 1 ? "" : "s"} saved for today`,
          {
            description: notes.join(" · ") || undefined,
          },
        );
      } else {
        toast.info("No prices saved", {
          description: notes.join(" · ") || "No quotes came back.",
        });
      }
    } catch (error) {
      toast.error("Couldn't fetch prices", {
        description: getErrorMessage(error),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void run()}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="mr-2 size-4" aria-hidden />
      )}
      Today&apos;s prices from Discover
    </Button>
  );
}
