import type { Habit } from "@/types";
import { DEFAULT_HABIT_COLOR } from "@/lib/constants";

/**
 * The habit's accent colour, or the shared default.
 *
 * `habits.color` is a nullable column, and each consumer had invented its own
 * answer: the confetti burst fell back to `#60a5fa`, the heatmap passed the
 * raw value through (rendering no colour at all), and the form defaulted to
 * `#3b82f6`. Three fallbacks for one missing value.
 */
export function habitColor(habit: Pick<Habit, "color">): string {
  return habit.color?.trim() || DEFAULT_HABIT_COLOR;
}
