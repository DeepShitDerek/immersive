"use client";

import { toast } from "sonner";
import type { CalendarEntry } from "@/types";
import {
  useDeleteEventExceptionMutation,
  useDeleteEventMutation,
  useSaveEventExceptionMutation,
} from "@/store/api/adminApi";
import {
  useChoice,
  useConfirm,
} from "@/components/providers/confirm-dialog-provider";
import { useUndoableDelete } from "@/hooks/use-undoable-delete";
import { getErrorMessage } from "@/lib/utils";

/**
 * Delete and reset, shared by the popover and the editor.
 *
 * A one-off event is deleted with Undo: it leaves the grid at once
 * and nothing is removed until the toast closes. One occurrence of a series
 * asks whether "this" means the occurrence or the series: removing just
 * this one writes a cancellation, never deletes the row (which would take
 * every other Thursday with it).
 */
export function useEventActions() {
  const [deleteEvent] = useDeleteEventMutation();
  const [deleteException] = useDeleteEventExceptionMutation();
  const [saveException] = useSaveEventExceptionMutation();
  const choose = useChoice();
  const confirm = useConfirm();

  const { pending, remove } = useUndoableDelete<{
    id: string;
    sourceId: string;
  }>(async ({ sourceId }) => {
    try {
      await deleteEvent(sourceId).unwrap();
    } catch (err) {
      toast.error("Couldn't delete the event", {
        description: getErrorMessage(err),
      });
    }
  });

  /** Returns true once the entry is gone (or going), so callers can close. */
  const deleteEntry = async (entry: CalendarEntry): Promise<boolean> => {
    if (entry.kind !== "event") return false;
    if (entry.rrule && entry.occurrenceStart) {
      const choice = await choose({
        title: "Delete the whole series?",
        description:
          "This event repeats. Deleting the series removes every occurrence; deleting just this one leaves the rest in place.",
        confirmText: "Whole series",
        alternativeText: "Just this one",
        variant: "destructive",
      });
      if (!choice) return false;
      try {
        if (choice === "confirm") {
          await deleteEvent(entry.sourceId).unwrap();
          toast.success("Series deleted");
        } else {
          await saveException({
            event_id: entry.sourceId,
            original_start: entry.occurrenceStart.toISOString(),
            is_cancelled: true,
          }).unwrap();
          toast.success("This occurrence removed");
        }
        return true;
      } catch (err) {
        toast.error("Couldn't delete it", {
          description: getErrorMessage(err),
        });
        return false;
      }
    }
    remove(
      { id: entry.sourceId, sourceId: entry.sourceId },
      `Deleted “${entry.title || "Untitled"}”`,
    );
    return true;
  };

  /** Put a moved or renamed occurrence back in step with its series. */
  const resetOccurrence = async (entry: CalendarEntry): Promise<boolean> => {
    if (!entry.exceptionId) return false;
    const ok = await confirm({
      title: "Reset this occurrence?",
      description:
        "The changes made to this one occurrence are discarded and it follows the series again.",
      confirmText: "Reset",
    });
    if (!ok) return false;
    try {
      await deleteException(entry.exceptionId).unwrap();
      toast.success("Back in step with the series");
      return true;
    } catch (err) {
      toast.error("Couldn't reset it", { description: getErrorMessage(err) });
      return false;
    }
  };

  /** Source ids waiting on their Undo: hidden from the grid meanwhile. */
  return { deleteEntry, resetOccurrence, pendingDeletes: pending };
}
