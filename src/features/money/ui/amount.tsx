"use client";

import { cn } from "@/lib/cn";
import { formatMoney, money, type FormatOptions } from "../domain/money";

/**
 * An amount for people. Tabular figures so columns line up;
 * colour only where direction is the point (`tone`), and never colour
 * alone — the sign is always printed.
 */
export function Amount({
  minor,
  currency,
  tone = "none",
  className,
  ...options
}: {
  minor: number;
  currency: string;
  /** "flow": green in, default out. "balance": red when negative. */
  tone?: "none" | "flow" | "balance";
  className?: string;
} & FormatOptions) {
  const text = formatMoney(money(minor, currency), options);
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        tone === "flow" && minor > 0 && "text-success",
        tone === "balance" && minor < 0 && "text-destructive",
        className,
      )}
    >
      {text}
    </span>
  );
}
