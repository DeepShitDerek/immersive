"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** How long the Undo stays offered. Sonner pauses it while hovered or focused. */
const UNDO_MS = 6000;

/**
 * Delete with Undo instead of "Are you sure?".
 *
 * The item leaves the list at once and a toast offers Undo. The real delete
 * runs only when the toast closes on its own or is dismissed, so Undo is a
 * true undo: nothing was deleted yet, which matters here because a task's
 * delete cascades to its subtasks and dependency edges and could not be
 * rebuilt afterwards.
 *
 * Leaving the page commits what is pending; navigation is not an undo.
 * Closing the tab inside the window keeps the item, the safe failure.
 *
 * `pending` holds the ids to hide from the list meanwhile; `remove(item,
 * title, description)` starts one.
 */
export function useUndoableDelete<T extends { id: string }>(
  commit: (item: T) => Promise<void>,
) {
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  /** Waiting items, by id, so an unmount can commit them. */
  const waiting = useRef(new Map<string, T>());
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  const release = useCallback((id: string) => {
    waiting.current.delete(id);
    setPending((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const run = useCallback(
    async (item: T) => {
      if (!waiting.current.has(item.id)) return;
      waiting.current.delete(item.id);
      try {
        await commitRef.current(item);
      } finally {
        // On success the refetch removes the row; on failure it comes back.
        release(item.id);
      }
    },
    [release],
  );

  const remove = useCallback(
    (item: T, title: string, description?: string) => {
      waiting.current.set(item.id, item);
      setPending((current) => new Set(current).add(item.id));
      let undone = false;
      toast(title, {
        description,
        duration: UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            undone = true;
            release(item.id);
          },
        },
        onAutoClose: () => void run(item),
        onDismiss: () => {
          if (!undone) void run(item);
        },
      });
    },
    [release, run],
  );

  // Navigating away commits; it is not an undo.
  useEffect(
    () => () => {
      for (const item of waiting.current.values()) void commitRef.current(item);
      waiting.current.clear();
    },
    [],
  );

  return { pending, remove };
}
