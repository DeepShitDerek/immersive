import type { Rule } from "./model";

/**
 * Categorisation rules. Case-insensitive, highest priority first,
 * first match wins — a rule for "AMAZON PRIME" at priority 200 beats a rule
 * for "AMAZON" at 100, which is what makes a specific rule worth writing.
 *
 * Postgres validates a regex on save (`money_check_rule`), but its dialect
 * is not JavaScript's; a pattern Postgres accepts and JS rejects is treated
 * as not matching rather than breaking an import.
 */

export interface RuleInput {
  description: string;
  payee?: string | null;
  accountId: string;
}

export interface RuleResult {
  categoryId: string | null;
  payee: string | null;
  ruleId: string;
}

const compiled = new Map<string, RegExp | null>();

function regexFor(pattern: string): RegExp | null {
  if (!compiled.has(pattern)) {
    try {
      compiled.set(pattern, new RegExp(pattern, "i"));
    } catch {
      compiled.set(pattern, null);
    }
  }
  return compiled.get(pattern)!;
}

export function isValidPattern(rule: Pick<Rule, "match" | "pattern">): boolean {
  if (rule.pattern.trim().length === 0 || rule.pattern.length > 200)
    return false;
  return rule.match !== "regex" || regexFor(rule.pattern) !== null;
}

/** Normalise bank text: case, runs of spaces, and the odd non-breaking space. */
export const normaliseText = (text: string): string =>
  text
    .replace(/[\s ]+/g, " ")
    .trim()
    .toLowerCase();

export function ruleMatches(
  rule: Pick<Rule, "match" | "pattern">,
  text: string,
): boolean {
  const haystack = normaliseText(text);
  const needle = normaliseText(rule.pattern);
  if (!needle) return false;
  switch (rule.match) {
    case "contains":
      return haystack.includes(needle);
    case "starts_with":
      return haystack.startsWith(needle);
    case "equals":
      return haystack === needle;
    case "regex":
      return regexFor(rule.pattern)?.test(text) ?? false;
  }
}

export function applyRules(
  rules: readonly Rule[],
  input: RuleInput,
): RuleResult | null {
  const ordered = rules
    .filter(
      (rule) =>
        rule.isActive &&
        (!rule.accountId || rule.accountId === input.accountId),
    )
    .slice()
    .sort((a, b) => b.priority - a.priority);
  // Each field on its own: "equals Netflix" must still match when the
  // description is "NETFLIX.COM" and the payee was already set to Netflix.
  const fields = [input.description, input.payee ?? ""].filter((text) =>
    text.trim(),
  );
  for (const rule of ordered) {
    if (fields.some((text) => ruleMatches(rule, text))) {
      return {
        categoryId: rule.categoryId,
        payee: rule.payee,
        ruleId: rule.id,
      };
    }
  }
  return null;
}
