import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind class names, letting later classes win conflicts.
 *
 * Kept in its own leaf module rather than in `utils.ts`. `utils.ts` re-exports
 * from `date-utils` (and therefore date-fns), and the package is not marked
 * `sideEffects: false`, so webpack cannot drop those re-exports — importing
 * `cn` alone pulled date-fns into the chunk. That is invisible on a page that
 * already uses dates, but the two code-split admin routes (`/admin`,
 * `/admin/calendar`) are near-empty shells whose first load nearly doubled.
 *
 * `utils.ts` re-exports this, so existing `import { cn } from "@/lib/utils"`
 * call sites keep working.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
