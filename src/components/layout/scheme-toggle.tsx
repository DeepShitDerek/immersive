"use client";

import { Moon, Sun } from "lucide-react";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { cn } from "@/lib/cn";

/**
 * A visitor's light/dark switch (a light/dark toggle, not the
 * full preset list). It swaps the owner's theme for its partner in the other
 * scheme, or the core Field Notes pair when it has none, and remembers the
 * choice in this browser only.
 *
 * Until mounted the scheme is unknown, so a same-sized blank holds the place:
 * a guessed icon would hydrate wrong for half the visitors, and an empty slot
 * would shift the header when the button arrives.
 */
export function SchemeToggle({ className }: { className?: string }) {
  const { scheme, setScheme } = useColorScheme();
  const box = cn(
    "size-10 shrink-0 [@media(pointer:coarse)]:size-11",
    className,
  );

  if (!scheme) return <span aria-hidden className={box} />;

  const next = scheme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setScheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className={cn(
        box,
        "inline-flex items-center justify-center rounded-control text-muted-foreground transition-colors duration-fast hover:bg-secondary hover:text-foreground focus-ring",
      )}
    >
      {scheme === "dark" ? (
        <Sun className="size-[1.125rem]" aria-hidden />
      ) : (
        <Moon className="size-[1.125rem]" aria-hidden />
      )}
    </button>
  );
}
