"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageSquare, TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { fetchJson } from "./sources";
import { fetchReading, type ReadingItem } from "./reading";

/**
 * "What is most worth reading right now?"
 *
 * Ranked on real engagement — Hacker News points and comments, dev.to
 * reactions and comments — adjusted for age, so this morning's post can
 * outrank last week's. Nothing here is invented: an article with no signal is
 * not given a plausible one, it is left out.
 *
 * **On Substack**, which was the example asked for: it publishes no public API
 * for likes or shares, so "articles with more than 30k likes" cannot be
 * answered from it honestly. The two sources here do publish those numbers,
 * which is the whole reason they are the two.
 */

const WINDOWS: { days: number; label: string }[] = [
  { days: 1, label: "Today" },
  { days: 7, label: "This week" },
  { days: 30, label: "This month" },
];

const SOURCE_LABEL: Record<ReadingItem["source"], string> = {
  hackernews: "Hacker News",
  devto: "dev.to",
};

export function ReadingPanel() {
  const [days, setDays] = useState(7);
  const [items, setItems] = useState<ReadingItem[]>([]);
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");

    void (async () => {
      const result = await fetchReading(days, fetchJson);
      if (cancelled) return;

      if (result === null) {
        setState("failed");
        return;
      }
      setItems(result);
      setState("done");
    })();

    return () => {
      cancelled = true;
    };
  }, [days]);

  const top = useMemo(() => items[0]?.points ?? 1, [items]);

  return (
    <section className="overflow-hidden rounded-surface border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
          Most worth reading
        </h2>
        <div
          role="tablist"
          aria-label="Window"
          className="flex gap-1 rounded-control bg-secondary p-0.5"
        >
          {WINDOWS.map((option) => (
            <button
              key={option.days}
              type="button"
              role="tab"
              aria-selected={option.days === days}
              onClick={() => setDays(option.days)}
              className={cn(
                "rounded-control px-2.5 py-1 text-micro font-medium transition-colors",
                option.days === days
                  ? "bg-card text-foreground shadow-e1"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {state === "loading" && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">Reading…</p>
      )}

      {state === "failed" && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Neither source answered just now.
        </p>
      )}

      {state === "done" && items.length === 0 && (
        <p className="px-5 pb-4 text-sm text-muted-foreground">
          Nothing has picked up much attention in this window yet.
        </p>
      )}

      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block border-t border-border/60 px-5 py-2.5 transition-colors hover:bg-secondary/50"
            >
              <p className="flex items-start gap-2 text-sm font-medium leading-snug">
                {/* break-words: a title is often one long unbroken token. */}
                <span className="min-w-0 break-words">{item.title}</span>
                <ExternalLink
                  className="mt-0.5 size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </p>

              <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-micro text-muted-foreground">
                <span>{SOURCE_LABEL[item.source]}</span>
                <span className="tabular-nums">{item.points} points</span>
                {item.comments > 0 && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <MessageSquare className="size-3" aria-hidden />
                    {item.comments}
                  </span>
                )}
                {item.readingMinutes !== null && (
                  <span className="tabular-nums">
                    {item.readingMinutes} min read
                  </span>
                )}
              </p>

              {/*
                The bar is relative to the busiest item in this window, not to
                an absolute scale — 400 points is a huge day on dev.to and an
                ordinary one on Hacker News, so an absolute bar would say more
                about which site something came from than about how much
                attention it got.
              */}
              <span
                aria-hidden
                className="mt-1.5 block h-0.5 rounded-full bg-primary/40"
                style={{
                  width: `${Math.max((item.points / Math.max(top, 1)) * 100, 3)}%`,
                }}
              />
            </a>
          </li>
        ))}
      </ul>

      <p className="border-t border-border/60 px-5 py-2 text-micro text-muted-foreground">
        Ranked on upvotes, reactions and comments, weighted down by age.
        Substack publishes no public like or share counts, so it cannot be
        ranked here.
      </p>
    </section>
  );
}
