// Core utilities - cn() for Tailwind class merging and slugify()

/**
 * `cn` is defined in `./cn` and re-exported here so the hundreds of existing
 * `import { cn } from "@/lib/utils"` call sites keep working. Modules that
 * want *only* class merging should import from `@/lib/cn` — see the note there
 * about this file's date-fns re-exports.
 */
export { cn } from "./cn";

/**
 * Convert a string to a URL-friendly slug.
 *
 * @param text - Text to slugify
 * @returns URL-safe slug
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
}

// =============================================================================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// =============================================================================
// These functions have been moved to dedicated utility files but are re-exported
// here to maintain backward compatibility with existing imports.

export { getStorageUrl } from "./storage-utils";
export { parseLocalDate, formatDate } from "./date-utils";
const WORDS_PER_MINUTE = 225;

export function readTimeFromWordCount(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

export function calculateReadTime(content: string = ""): number {
  return readTimeFromWordCount(content.split(/\s+/).filter(Boolean).length);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "An unexpected error occurred";
}
