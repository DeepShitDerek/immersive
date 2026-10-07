"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  useDeleteWatchlistEntryMutation,
  useGetWatchlistQuery,
  useSaveWatchlistEntryMutation,
  useUpdateIntegrationSettingsMutation,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import { fetchJson } from "./sources";
import {
  groupByKind,
  normalizeSymbol,
  quoteUrl,
  type WatchlistEntry,
} from "./watchlist";
import {
  fetchQuotes,
  isQuotable,
  QUOTE_PROVIDERS,
  type Quote,
  type QuoteProvider,
} from "./quotes";
import { WatchlistAddForm } from "./watchlist-add";

/**
 * What you follow, and — where it is possible — what it costs.
 *
 * The two tiers are visible rather than hidden, because the difference is not
 * a bug the reader should have to work out:
 *
 * - **Crypto is live with nothing configured.** CoinGecko is keyless and
 *   CORS-open.
 * - **Stocks, ETFs and indices are live once you add your own free key.** No
 *   keyless CORS-open source for them exists — that was tested rather than
 *   assumed; `watchlist.ts` records what each candidate returned.
 * - **Funds and bonds link out.** Neither free tier covers them, and a row
 *   showing nothing beside neighbours showing prices reads as a broken fetch
 *   rather than as a limit, so it says so instead.
 *
 * Quotes are fetched on demand, not on every render: both free tiers are
 * per-minute or per-day budgets, and a watchlist that silently spent them
 * would stop working at the moment it was most wanted.
 */
export function WatchlistPanel({
  baseCurrency,
  provider,
  apiKey,
}: {
  baseCurrency: string;
  provider?: QuoteProvider | null;
  apiKey?: string | null;
}) {
  const { data: entries = [], isLoading } = useGetWatchlistQuery();
  const [saveEntry] = useSaveWatchlistEntryMutation();
  const [deleteEntry] = useDeleteWatchlistEntryMutation();
  const confirm = useConfirm();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pricing, setPricing] = useState(false);
  const [adding, setAdding] = useState(false);

  const hasKey = Boolean(provider && apiKey);
  const groups = useMemo(() => groupByKind(entries), [entries]);
  const byEntry = useMemo(
    () => new Map(quotes.map((quote) => [quote.entryId, quote])),
    [quotes],
  );

  const priceable = useMemo(
    () => entries.filter((entry) => isQuotable(entry.kind, hasKey)),
    [entries, hasKey],
  );

  const refresh = useMemo(
    () => async () => {
      if (priceable.length === 0) return;
      setPricing(true);
      const result = await fetchQuotes(priceable, {
        baseCurrency,
        provider,
        key: apiKey,
        fetchJson,
      });
      setQuotes(result);
      setPricing(false);
    },
    [priceable, baseCurrency, provider, apiKey],
  );

  // Once on arrival, and on demand after. Not on every render: both free tiers
  // are budgets, and spending them silently is how the feature dies quietly.
  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, hasKey]);

  const remove = async (entry: WatchlistEntry) => {
    const ok = await confirm({
      title: `Stop watching ${entry.symbol}?`,
      description: "Only the entry goes; nothing else references it.",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteEntry(entry.id).unwrap();
    } catch (error) {
      toast.error("Could not remove it", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <section className="overflow-hidden rounded-surface border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-4">
        <h2 className="text-sm font-semibold">Watchlist</h2>
        <div className="flex items-center gap-1.5">
          {priceable.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => void refresh()}
              disabled={pricing}
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", pricing && "animate-spin")}
                aria-hidden
              />
              {pricing ? "Pricing…" : "Refresh"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() => setAdding((open) => !open)}
          >
            <Plus className="mr-1.5 size-3.5" aria-hidden />
            Add
          </Button>
        </div>
      </header>

      {adding && (
        <WatchlistAddForm
          entries={entries}
          onCancel={() => setAdding(false)}
          onSave={async (input) => {
            try {
              await saveEntry(input).unwrap();
              setAdding(false);
            } catch (error) {
              toast.error("Could not add it", {
                description: getErrorMessage(error),
              });
            }
          }}
        />
      )}

      {isLoading && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">Reading…</p>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Nothing on the list yet. Add a ticker and it stays here — crypto
          prices itself straight away, and everything else links out until you
          add a market-data key.
        </p>
      )}

      {groups.map((group) => (
        <div key={group.kind}>
          <h3 className="t-eyebrow border-t border-border/60 bg-secondary/40 px-5 py-1.5">
            {group.label}
          </h3>
          <ul>
            {group.entries.map((entry) => (
              <Row
                key={entry.id}
                entry={entry}
                quote={byEntry.get(entry.id)}
                quotable={isQuotable(entry.kind, hasKey)}
                hasKey={hasKey}
                onRemove={() => void remove(entry)}
              />
            ))}
          </ul>
        </div>
      ))}

      {/*
        The key is the difference between a list and a board, so the offer to
        add one belongs where the gap is visible — not buried in a settings
        screen the reader has no reason to open.
      */}
      <MarketKeySettings provider={provider} hasKey={hasKey} />
    </section>
  );
}

function Row({
  entry,
  quote,
  quotable,
  hasKey,
  onRemove,
}: {
  entry: WatchlistEntry;
  quote?: Quote;
  quotable: boolean;
  hasKey: boolean;
  onRemove: () => void;
}) {
  return (
    <li className="group flex items-center gap-3 border-t border-border/60 px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
          <span className="tabular-nums">{normalizeSymbol(entry.symbol)}</span>
          {entry.exchange && (
            <span className="text-micro font-normal text-muted-foreground">
              {entry.exchange}
            </span>
          )}
        </p>
        {(entry.name || entry.note) && (
          <p className="truncate text-micro text-muted-foreground">
            {entry.name ?? entry.note}
          </p>
        )}
      </div>

      <div className="shrink-0 text-right">
        {quote ? (
          <>
            <p className="text-sm tabular-nums">
              {quote.price.toLocaleString(undefined, {
                maximumFractionDigits: quote.price < 10 ? 4 : 2,
              })}
              {quote.currency && (
                <span className="ml-1 text-micro text-muted-foreground">
                  {quote.currency}
                </span>
              )}
            </p>
            {quote.change !== null && (
              /*
                Up is `success`, down `destructive`: the status tokens every
                preset sets and check:themes holds to 4.5:1. The sign is
                printed too, so colour is never the only cue.
              */
              <p
                className={cn(
                  "text-micro tabular-nums",
                  quote.change >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {quote.change >= 0 ? "+" : ""}
                {quote.change.toFixed(2)}%
              </p>
            )}
          </>
        ) : (
          <p className="text-micro text-muted-foreground">
            {quotable ? "—" : hasKey ? "not priced" : "no key"}
          </p>
        )}
      </div>

      <a
        href={quoteUrl(entry)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Look up ${entry.symbol}`}
        className="shrink-0 rounded-control p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <ExternalLink className="size-3.5" aria-hidden />
      </a>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Stop watching ${entry.symbol}`}
        className="shrink-0 rounded-control p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}

/**
 * Where the key is pasted — inside the panel it unlocks.
 *
 * Not on a settings screen. The reader meets the limitation here, on the rows
 * showing "no key", and the offer to fix it belongs at that moment rather than
 * three clicks away behind a heading they had no reason to open.
 *
 * The field is a password input and the stored value is never rendered back:
 * it is a credential, and a screen that redisplays one teaches its owner that
 * doing so is fine.
 */
function MarketKeySettings({
  provider,
  hasKey,
}: {
  provider?: QuoteProvider | null;
  hasKey: boolean;
}) {
  const [updateSettings, { isLoading }] =
    useUpdateIntegrationSettingsMutation();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [chosen, setChosen] = useState<QuoteProvider>(provider ?? "finnhub");

  const save = async (nextKey: string | null) => {
    try {
      await updateSettings({
        market_data_key: nextKey,
        market_data_provider: nextKey ? chosen : null,
      }).unwrap();
      setKey("");
      setOpen(false);
      toast.success(nextKey ? "Market data connected." : "Key removed.");
    } catch (error) {
      toast.error("Could not save the key", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <div className="border-t border-border/60 px-5 py-2.5">
      {!open ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-micro leading-relaxed text-muted-foreground">
          {hasKey ? (
            <>
              <span>
                Prices from{" "}
                {QUOTE_PROVIDERS.find((entry) => entry.id === provider)
                  ?.label ?? provider}
                .
              </span>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Change or remove the key
              </button>
            </>
          ) : (
            <>
              <span>
                Crypto is priced live. Stocks, ETFs and indices need a
                market-data key of your own — this site is a static export, so a
                shared one would be published in the page.
              </span>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Add a key
              </button>
            </>
          )}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={chosen}
              onChange={(event) =>
                setChosen(event.target.value as QuoteProvider)
              }
              aria-label="Market data provider"
              className="h-8 rounded-control border border-input bg-background px-2 text-sm focus-ring"
            >
              {QUOTE_PROVIDERS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>

            <Input
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="API key"
              aria-label="Market data API key"
              className="h-8 min-w-0 flex-1"
            />

            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={!key.trim() || isLoading}
              onClick={() => void save(key.trim())}
            >
              Save
            </Button>
            {hasKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => void save(null)}
              >
                Remove
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Cancel"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>

          <p className="text-micro leading-relaxed text-muted-foreground">
            Free keys:{" "}
            {QUOTE_PROVIDERS.map((entry, index) => (
              <span key={entry.id}>
                {index > 0 && " · "}
                <a
                  href={entry.signup}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {entry.label}
                </a>{" "}
                ({entry.freeTier})
              </span>
            ))}
            . Stored on a table with no public read policy, so it is never sent
            to a visitor.
          </p>
        </div>
      )}
    </div>
  );
}
