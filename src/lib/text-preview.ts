/**
 * The first line of a markdown body, with its markup taken off.
 *
 * Lives here rather than in a feature because two of them need it — Notes and
 * Life updates both have an optional title and both were writing "Untitled"
 * over content that already said what it was. A feature reaching into another
 * feature's internals is what the architecture forbids, and this is
 * domain-independent text handling.
 *
 * The raw first line is as likely to be `## Heading` or `- [ ] thing` as it is
 * prose, so leading syntax is stripped rather than the whole line skipped:
 * `# Groceries` should read "Groceries", not fall through to the second line.
 */

/** Longer than this and a card truncates anyway; cut on a word where possible. */
const MAX_PREVIEW = 60;

export function firstMeaningfulLine(content: string): string {
  for (const raw of content.split(/\r?\n/)) {
    const line = raw
      .replace(/^\s*#{1,6}\s+/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/^\s*[-*+]\s+(\[[ xX]\]\s*)?/, "")
      .replace(/^\s*\d+[.)]\s+/, "")
      // Emphasis and code markers, left over once the line is unwrapped.
      .replace(/[*_`~]/g, "")
      .trim();

    // A fence or a rule is not a line of text.
    if (!line || /^([-*_])\1{2,}$/.test(line.replace(/\s/g, ""))) continue;

    return line.length > MAX_PREVIEW
      ? `${line.slice(0, MAX_PREVIEW).replace(/\s+\S*$/, "")}…`
      : line;
  }

  return "";
}

/**
 * Markdown flattened to one paragraph of plain text, for card previews where
 * rendered markdown would be noise and a CSS line clamp does the truncating.
 * Link and image syntax keeps its visible text; code, emphasis, heading and
 * list markers go.
 */
export function plainPreview(markdown: string | null | undefined): string {
  if (!markdown) return "";
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
