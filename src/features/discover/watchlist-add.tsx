"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchJson } from "./sources";
import {
  INSTRUMENT_KINDS,
  normalizeSymbol,
  validateEntry,
  type InstrumentKind,
  type WatchlistEntry,
} from "./watchlist";
import { searchSymbols, type SymbolResult } from "./symbol-search";

/**
 * Find it by name; the ticker and the venue come with the result.
 *
 * The first version of this was two text boxes, and asking somebody to type a
 * symbol and an exchange code is a bad ask. The live search for "shopify"
 * returns six listings with **four different tickers** — `SHOP` on NASDAQ,
 * `SHOP` on the TSX in Canadian dollars, `SHOPN` on the BMV, `0VHA` on the
 * LSE. Nobody reproduces that from memory, and getting it wrong means either
 * no quote at all or, worse, a right-looking price in the wrong currency.
 *
 * Both search endpoints are keyless, so this works before any key is
 * configured: searching and pricing are separate capabilities here, and only
 * the second one needs a key.
 *
 * Manual entry stays behind a toggle. A search that cannot find something must
 * never be the only way in — bonds and some funds are not in either index.
 */
export function WatchlistAddForm({
  entries,
  onSave,
  onCancel,
}: {
  entries: WatchlistEntry[];
  onSave: (input: Partial<WatchlistEntry>) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [manual, setManual] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [symbol, setSymbol] = useState("");
  const [kind, setKind] = useState<InstrumentKind>("stock");
  const [exchange, setExchange] = useState("");

  /**
   * Debounced, and a stale reply is discarded.
   *
   * Without the second half, a slow response for "sh" can land after the one
   * for "shopify" and replace it — the results then disagree with the box they
   * were typed into, which reads as the search being broken rather than slow.
   */
  useEffect(() => {
    if (manual) return;

    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        const found = await searchSymbols(term, fetchJson);
        if (cancelled) return;
        setResults(found);
        setSearching(false);
      })();
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, manual]);

  const add = (input: {
    symbol: string;
    kind: InstrumentKind;
    exchange: string | null;
    name?: string | null;
    currency?: string | null;
  }) => {
    const found = validateEntry(entries, {
      symbol: input.symbol,
      exchange: input.exchange,
    });
    if (found) {
      setProblem(found.message);
      return;
    }

    onSave({
      symbol: normalizeSymbol(input.symbol),
      kind: input.kind,
      exchange: input.exchange,
      name: input.name ?? null,
      currency: input.currency ?? null,
      note: note.trim() || null,
    });
  };

  return (
    <div className="border-t border-border/60 bg-secondary/30 px-5 py-3">
      {manual ? (
        <div className="flex flex-wrap items-start gap-2">
          <Input
            autoFocus
            value={symbol}
            onChange={(event) => {
              setSymbol(event.target.value);
              setProblem(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                add({ symbol, kind, exchange: exchange.trim() || null });
              }
              if (event.key === "Escape") onCancel();
            }}
            placeholder="Symbol"
            aria-label="Symbol"
            className="h-8 w-28 tabular-nums"
          />

          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as InstrumentKind)}
            aria-label="Kind"
            className="h-8 rounded-control border border-input bg-background px-2 text-sm focus-ring"
          >
            {INSTRUMENT_KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>

          <Input
            value={exchange}
            onChange={(event) => setExchange(event.target.value)}
            placeholder="Exchange"
            aria-label="Exchange"
            className="h-8 w-24"
          />

          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={() =>
              add({ symbol, kind, exchange: exchange.trim() || null })
            }
          >
            Add
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setProblem(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") onCancel();
              }}
              placeholder="Search by name or ticker — Shopify, VFV, bitcoin…"
              aria-label="Search for an instrument"
              className="h-8 pl-8"
            />
          </div>

          {searching && (
            <p className="mt-2 text-micro text-muted-foreground">Searching…</p>
          )}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="mt-2 text-micro text-muted-foreground">
              Nothing found —{" "}
              <button
                type="button"
                onClick={() => setManual(true)}
                className="underline underline-offset-2 hover:text-foreground"
              >
                enter it by hand
              </button>
              .
            </p>
          )}

          {results.length > 0 && (
            <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
              {results.map((result) => (
                <li key={`${result.symbol}-${result.exchange ?? "any"}`}>
                  <button
                    type="button"
                    onClick={() =>
                      add({
                        symbol: result.symbol,
                        kind: result.kind,
                        exchange: result.exchange,
                        name: result.name,
                        currency: result.currency,
                      })
                    }
                    className="flex w-full items-baseline gap-2 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-card focus-ring"
                  >
                    <span className="shrink-0 text-sm font-medium tabular-nums">
                      {result.symbol}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-micro text-muted-foreground">
                      {result.name}
                    </span>
                    {/*
                      Venue and currency are the disambiguator — the same
                      company is a different ticker at a different price on each
                      one, so a result without them would not be choosable.
                    */}
                    <span className="shrink-0 text-micro text-muted-foreground">
                      {[result.exchange, result.currency]
                        .filter(Boolean)
                        .join(" · ") ||
                        INSTRUMENT_KINDS.find(
                          (entry) => entry.id === result.kind,
                        )?.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why are you watching it? (optional)"
          aria-label="Note"
          className="h-8 min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={() => setManual((current) => !current)}
        >
          {manual ? "Search instead" : "Enter by hand"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Cancel"
          onClick={onCancel}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      {problem && (
        <p className="mt-1.5 text-micro text-destructive">{problem}</p>
      )}
    </div>
  );
}
