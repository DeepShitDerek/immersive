"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Circle, CircleCheck } from "lucide-react";
import {
  useGetAdminBlogPostsQuery,
  useGetPortfolioContentQuery,
  useGetSiteSettingsQuery,
  useGetStorageStatusQuery,
} from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { normalizeSiteContent } from "@/lib/site-identity";
import { cn } from "@/lib/cn";
import { setupItems } from "./setup-checklist";

const SETUP_DISMISS_KEY = "setup-checklist-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(SETUP_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * "Get your site ready" — the first thing a new owner sees on the dashboard,
 * and the thing that turns a fresh install into their site.
 *
 * Each step is read from the data, links straight to where it is done, and
 * disappears from the dashboard entirely once every step is. It can be hidden
 * for now; hiding is per browser, because it is a convenience, not a record.
 */
export function SetupChecklist() {
  const { data: settings } = useGetSiteSettingsQuery();
  const { data: sections } = useGetPortfolioContentQuery();
  const { data: posts } = useGetAdminBlogPostsQuery();
  const { data: storage } = useGetStorageStatusQuery();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!settings || dismissed) return null;

  const items = setupItems({
    identity: normalizeSiteContent(settings),
    sectionCount: sections?.length ?? 0,
    publishedPostCount: (posts ?? []).filter((post) => post.published).length,
    storage: storage ?? "unknown",
  });
  const left = items.filter((item) => !item.done).length;
  if (left === 0) return null;
  const doneCount = items.length - left;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(SETUP_DISMISS_KEY, "1");
    } catch {
      // Hiding still works for this visit.
    }
  };

  return (
    <section
      aria-labelledby="setup-heading"
      className="rounded-surface bg-card p-5 shadow-e1 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id="setup-heading"
            className="text-base font-semibold text-foreground"
          >
            Get your site ready
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {doneCount} of {items.length} done — {left} to go.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Hide for now
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={doneCount}
        className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-enter motion-reduce:transition-none"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>

      <ul className="mt-5 grid gap-1 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            {item.done ? (
              <div className="flex items-start gap-3 rounded-control px-3 py-2.5">
                <CircleCheck
                  className="mt-0.5 size-4 shrink-0 text-chart-2"
                  aria-hidden
                />
                <span className="text-sm text-muted-foreground">
                  {item.title}
                  <span className="sr-only"> — done</span>
                </span>
              </div>
            ) : (
              <Link
                href={item.href}
                className={cn(
                  "group flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors hover:bg-secondary/60",
                  "focus-ring",
                )}
              >
                <Circle
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <ArrowRight
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-base ease-enter group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
