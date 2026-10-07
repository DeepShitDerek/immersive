/**
 * One item, chosen at random, or null for an empty list.
 *
 * `random` is injectable so the choice is testable; the default is the only
 * place `Math.random` is reached. Used by the zero-config path of the public
 * highlight endpoint — with a database, the pick happens in Postgres instead.
 */
export function pickRandom<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T | null {
  if (items.length === 0) return null;
  const index = Math.min(Math.floor(random() * items.length), items.length - 1);
  return items[index] ?? null;
}
