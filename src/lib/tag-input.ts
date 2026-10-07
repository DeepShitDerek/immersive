/**
 * Add whatever was typed to a tag list: split on commas and new lines, trim,
 * drop a leading `#` (people type it because tags are shown with one), and
 * skip anything already present regardless of case.
 *
 * Shared by every tag field — Notes and Life updates both take tags as chips.
 */
export function addTags(existing: string[], raw: string): string[] {
  const next = [...existing];
  const seen = new Set(existing.map((tag) => tag.toLowerCase()));
  for (const part of raw.split(/[,\n]/)) {
    const tag = part.trim().replace(/^#+/, "").trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    next.push(tag);
  }
  return next;
}
