import type { Calendar } from "@/types";

/**
 * Option lists for the event sheet's two dropdowns.
 *
 * Radix renders a trigger whose value matches no `SelectItem` as blank, and a
 * blank box reads as "none". The moment anything else is picked the real value
 * is gone — silently, because the write looks like an ordinary edit. Both
 * builders below exist to keep a value the list would otherwise omit visible,
 * so changing it stays deliberate.
 *
 * Kept out of the component so the cases can be tested; the failure only shows
 * up with data the form did not create.
 */

/** Radix reserves the empty string for "nothing selected". */
export const NONE = "none";

const FREQUENCIES: { value: string; label: string }[] = [
  { value: NONE, label: "Does not repeat" },
  { value: "FREQ=DAILY", label: "Daily" },
  { value: "FREQ=WEEKLY", label: "Weekly" },
  { value: "FREQ=MONTHLY", label: "Monthly" },
  { value: "FREQ=YEARLY", label: "Yearly" },
];

/**
 * The calendars to offer, plus the current one when it is not among them.
 *
 * An event can sit on a calendar archived long afterwards, and the picker
 * hides archived calendars — so without this the box goes blank on exactly the
 * events that have the most history behind them.
 */
export function calendarOptionsFor(
  calendars: Calendar[],
  calendarId: string,
): Calendar[] {
  const visible = calendars.filter((entry) => !entry.archived_at);

  if (
    !calendarId ||
    calendarId === NONE ||
    visible.some((entry) => entry.id === calendarId)
  ) {
    return visible;
  }

  const archived = calendars.find((entry) => entry.id === calendarId);

  return [
    ...visible,
    {
      // A calendar that is gone entirely still needs a labelled option, or the
      // event looks uncategorised and one save makes that true.
      ...(archived ?? ({ id: calendarId } as Calendar)),
      name: archived ? `${archived.name} (archived)` : "Unknown calendar",
    },
  ];
}

/**
 * The five presets, plus the current rule when it is something richer.
 *
 * The recurrence parser understands more than the presets offer, so an event
 * carrying `FREQ=WEEKLY;BYDAY=MO,WE` has a rule no option matches. The rule is
 * kept verbatim and only its label admits it is not a preset, so editing an
 * unrelated field cannot quietly flatten the schedule.
 */
export function frequencyOptionsFor(
  rrule: string,
): { value: string; label: string }[] {
  // The empty check is not redundant: an option built from an empty rule would
  // be a `SelectItem value=""`, which is the crash the sentinel exists to
  // avoid. The fallback must not reintroduce it.
  if (!rrule || FREQUENCIES.some((option) => option.value === rrule)) {
    return FREQUENCIES;
  }

  return [...FREQUENCIES, { value: rrule, label: `Custom (${rrule})` }];
}
