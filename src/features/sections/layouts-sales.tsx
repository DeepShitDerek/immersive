"use client";

import { ChevronDown } from "lucide-react";
import type { PortfolioItem } from "@/types";
import { Stagger, StaggerItem } from "@/components/layout/motion";
import { cn } from "@/lib/cn";
import { CARD, Markdown, PlainText } from "./shared";

type LayoutProps = { items: PortfolioItem[] };

const PROCESS_COLUMNS: Record<number, string> = {
  1: "",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
};

/**
 * How working together goes, as numbered steps: `title` is the step,
 * `subtitle` how long it takes, `description` what happens in it.
 *
 * The step number is content — it is the order — so it is a real list, and
 * the number sits in the heading face rather than the retired mono voice.
 */
export function ProcessLayout({ items }: LayoutProps) {
  return (
    <Stagger
      as="ol"
      className={cn(
        "grid gap-5 sm:grid-cols-2",
        PROCESS_COLUMNS[items.length] ?? "lg:grid-cols-4",
      )}
    >
      {items.map((item, index) => (
        <StaggerItem
          as="li"
          key={item.id}
          className={cn(CARD, "flex min-w-0 flex-col p-6")}
        >
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-primary font-heading text-base font-semibold tabular-nums text-primary-foreground"
          >
            {index + 1}
          </span>
          <h3 className="mt-5 font-heading text-lg font-semibold [overflow-wrap:anywhere]">
            <span className="sr-only">{`Step ${index + 1}:`}</span> {item.title}
          </h3>
          <PlainText
            className="mt-1 text-sm font-medium text-primary"
            clamp={1}
          >
            {item.subtitle}
          </PlainText>
          <Markdown className="mt-3 text-muted-foreground">
            {item.description}
          </Markdown>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/**
 * Questions that open to their answers: `title` is the question,
 * `description` the answer (markdown).
 *
 * Native `<details>`, so every answer is in the page for search engines and
 * opens without JavaScript.
 */
export function FaqLayout({ items }: LayoutProps) {
  return (
    <div className="max-w-3xl space-y-3">
      {items.map((item) => (
        <details
          key={item.id}
          className={cn(
            CARD,
            "group [&_summary::-webkit-details-marker]:hidden",
          )}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-surface px-6 py-5 text-left font-heading text-base font-semibold focus-ring">
            <span className="[overflow-wrap:anywhere]">{item.title}</span>
            <ChevronDown
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-base group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <div className="px-6 pb-6">
            <Markdown className="text-muted-foreground">
              {item.description}
            </Markdown>
          </div>
        </details>
      ))}
    </div>
  );
}
