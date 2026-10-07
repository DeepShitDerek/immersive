/**
 * List ordering, shared by every module with a user-arranged list.
 *
 * Kept out of the component because the interesting part is a list
 * transformation, and because the failure it guards against is silent: the
 * reorder RPC numbers the ids it is *given*, so a partial list leaves every
 * omitted card holding a stale rank and the order comes apart on the next
 * read. That is invisible until a refresh.
 */

/**
 * Move `movedId` to sit immediately before `beforeId`, or last when that is
 * null. Returns the column's full new order, or `null` when nothing moved.
 *
 * Returning null rather than an unchanged list matters: it is what lets the
 * caller skip the write when a card is dropped back where it started, which is
 * most drags that get second thoughts halfway.
 */
export function moveWithin(
  order: string[],
  movedId: string,
  beforeId: string | null,
): string[] | null {
  if (!order.includes(movedId)) return null;
  if (beforeId === movedId) return null;

  const without = order.filter((id) => id !== movedId);
  const at = beforeId === null ? without.length : without.indexOf(beforeId);

  // A target that is not in this column means the drop was not a reorder.
  if (at === -1) return null;

  const next = [...without.slice(0, at), movedId, ...without.slice(at)];

  const unchanged =
    next.length === order.length && next.every((id, i) => id === order[i]);

  return unchanged ? null : next;
}

/**
 * Move the item at `id` one place in `direction`, for a list reordered by
 * buttons rather than dragging.
 *
 * Buttons are not a lesser fallback: a table row is an awkward drag target,
 * and drag as the *only* way to reorder cannot be done from a keyboard at all.
 *
 * Returns null at either end of the list, so the caller can disable the
 * control rather than writing an order that did not change.
 */
export function moveBy(
  order: string[],
  id: string,
  direction: -1 | 1,
): string[] | null {
  const from = order.indexOf(id);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= order.length) return null;

  const next = [...order];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}
