"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Habit } from "@/types";
import { useSaveHabitMutation } from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_HABIT_COLOR,
  HABIT_COLORS,
  HABIT_KIND_OPTIONS,
  HABIT_SCHEDULE_OPTIONS,
  HABIT_TIME_OF_DAY_OPTIONS,
  WEEKDAYS,
} from "@/lib/constants";
import { habitSchema, type HabitFormValues } from "@/lib/schemas";
import { getErrorMessage } from "@/lib/utils";
import { cn } from "@/lib/cn";

export interface HabitFormProps {
  habit: Habit | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function HabitForm({ habit, onSuccess, onCancel }: HabitFormProps) {
  const [saveHabit] = useSaveHabitMutation();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<HabitFormValues>({
    resolver: zodResolver(habitSchema),
    // Seeded from the prop at mount; the sheet keys this component per habit.
    defaultValues: {
      title: habit?.title ?? "",
      color: habit?.color ?? DEFAULT_HABIT_COLOR,
      kind: habit?.kind ?? "build",
      schedule: habit?.schedule ?? "daily",
      schedule_days: habit?.schedule_days ?? [1, 2, 3, 4, 5],
      target_per_week: habit?.target_per_week ?? 7,
      target_value: habit?.target_value ?? 1,
      unit: habit?.unit ?? "",
      step: habit?.step ?? 1,
      time_of_day: habit?.time_of_day ?? "anytime",
      category: habit?.category ?? "",
      notes: habit?.notes ?? "",
    },
  });

  const kind = form.watch("kind");
  const schedule = form.watch("schedule");
  const color = form.watch("color");
  const selectedDays = form.watch("schedule_days") ?? [];

  const toggleDay = (day: number) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day].sort((a, b) => a - b);
    form.setValue("schedule_days", next, { shouldValidate: true });
  };

  const handleSubmit = async (values: HabitFormValues) => {
    setIsSaving(true);
    try {
      await saveHabit({
        ...(habit?.id ? { id: habit.id } : {}),
        ...values,
        unit: values.unit || null,
        category: values.category || null,
        notes: values.notes || null,
        // Only meaningful for a custom schedule; storing stale days elsewhere
        // would make the summary line disagree with the behaviour.
        schedule_days:
          values.schedule === "custom" ? (values.schedule_days ?? []) : null,
      }).unwrap();
      toast.success(habit ? "Habit saved." : "Habit created.");
      onSuccess();
    } catch (err) {
      toast.error("Couldn't save the habit", {
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-5 pt-2"
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Habit</FormLabel>
              <FormControl>
                <Input {...field} autoFocus placeholder="Read for 20 minutes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {HABIT_KIND_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={field.value === option.value}
                    onClick={() => field.onChange(option.value)}
                    className={cn(
                      "rounded-surface border p-3 text-left transition-colors focus-ring",
                      field.value === option.value
                        ? "border-primary bg-primary/10"
                        : "hover:bg-secondary/60",
                    )}
                  >
                    <span className="block text-sm font-medium">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="schedule"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repeats</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {HABIT_SCHEDULE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {schedule === "custom" && (
          <FormField
            control={form.control}
            name="schedule_days"
            render={() => (
              <FormItem>
                <FormLabel>Days</FormLabel>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      aria-label={day.short}
                      aria-pressed={selectedDays.includes(day.value)}
                      onClick={() => toggleDay(day.value)}
                      className={cn(
                        "size-9 rounded-full text-xs font-medium transition-colors focus-ring",
                        selectedDays.includes(day.value)
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:bg-secondary/70",
                      )}
                    >
                      {day.letter}
                    </button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {schedule === "weekly_count" && (
          <FormField
            control={form.control}
            name="target_per_week"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Times per week</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={1} max={7} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* A quit habit has nothing to count up to — it is kept by not doing it. */}
        {kind === "build" && (
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="target_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min={1} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="glasses"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="step"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Step</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min={1} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {kind === "build" && (
          <FormDescription className="-mt-2">
            Leave the target at 1 for a simple check-in. Set it higher to count
            up — 8 glasses, 30 minutes — and the step is what one tap adds.
          </FormDescription>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="time_of_day"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time of day</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HABIT_TIME_OF_DAY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Health"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Colour</FormLabel>
              <div className="flex flex-wrap gap-2">
                {HABIT_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Colour ${swatch}`}
                    aria-pressed={color === swatch}
                    onClick={() => field.onChange(swatch)}
                    style={{ backgroundColor: swatch }}
                    className={cn(
                      "size-7 rounded-full ring-offset-2 ring-offset-background transition-shadow duration-fast hover:ring-2 hover:ring-border focus-ring",
                      color === swatch && "ring-2 ring-ring ring-offset-2",
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  rows={2}
                  placeholder="Why this matters, or how to make it easier"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            )}
            Save habit
          </Button>
        </div>
      </form>
    </Form>
  );
}
