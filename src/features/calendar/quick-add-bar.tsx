"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CornerDownLeft, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAddEventMutation } from "@/store/api/adminApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { eventSchema } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";
import { parseQuickAdd } from "./quick-add";
import { describeRRule } from "./recurrence";

/**
 * Type an event in a sentence.
 *
 * The interpretation is shown *before* it is saved, and that is the whole
 * safety argument for a hand-written parser: it does not have to be perfect if
 * you can see what it decided. A date parser that is confidently wrong and
 * silent is how appointments get missed.
 */
export function QuickAddBar({
  defaultCalendarId,
  className,
}: {
  defaultCalendarId: string | null;
  className?: string;
}) {
  const [addEvent, { isLoading }] = useAddEventMutation();
  const [text, setText] = useState("");

  const parsed = useMemo(
    () => (text.trim() ? parseQuickAdd(text) : null),
    [text],
  );

  const canSave = Boolean(parsed?.start);

  const submit = async () => {
    if (!parsed?.start) return;

    const draft = {
      title: parsed.title,
      start_time: parsed.start.toISOString(),
      end_time: parsed.end?.toISOString() ?? null,
      is_all_day: parsed.isAllDay,
      ...(parsed.rrule ? { rrule: parsed.rrule } : {}),
      ...(defaultCalendarId ? { calendar_id: defaultCalendarId } : {}),
    };

    // The same check the full sheet runs. Quick-add builds its payload from
    // free text, so it is the more likely of the two to produce something the
    // columns will not take.
    const checked = eventSchema.safeParse(draft);
    if (!checked.success) {
      toast.error("Could not add it", {
        description: checked.error.errors[0]?.message,
      });
      return;
    }

    try {
      await addEvent(draft as never).unwrap();
      setText("");
      toast.success(`Added “${parsed.title}”`);
    } catch (error) {
      toast.error("Could not add it", { description: getErrorMessage(error) });
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="relative">
        <Sparkles
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSave) void submit();
            if (event.key === "Escape") setText("");
          }}
          placeholder="dentist thursday 3pm · gym every tuesday 7am"
          aria-label="Add an event in words"
          className="pl-9 pr-24"
        />
        <Button
          type="button"
          size="sm"
          onClick={() => void submit()}
          disabled={!canSave || isLoading}
          className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2"
        >
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <>
              Add
              <CornerDownLeft className="ml-1.5 size-3" />
            </>
          )}
        </Button>
      </div>

      {/*
        The confirmation line. Shown as soon as anything is typed, so a
        misreading is visible before it becomes an appointment rather than
        after it is missed.
      */}
      {parsed && (
        <p className="px-1 text-xs text-muted-foreground">
          {parsed.start ? (
            <>
              <span className="font-medium text-foreground">
                {parsed.title}
              </span>
              {" · "}
              {parsed.isAllDay
                ? format(parsed.start, "EEEE d MMM")
                : format(parsed.start, "EEEE d MMM, HH:mm")}
              {parsed.rrule && ` · ${describeRRule(parsed.rrule)}`}
            </>
          ) : (
            <>
              No date found — try adding one, like “tomorrow 3pm” or “every
              tuesday”.
            </>
          )}
        </p>
      )}
    </div>
  );
}
