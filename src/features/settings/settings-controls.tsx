"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import type { UseFormReturn } from "react-hook-form";
import type { SiteSettingsFormValues } from "@/lib/schemas";
import { cn } from "@/lib/cn";

/**
 * The controls every settings group repeats.
 *
 * A switch row was written out in full in five of the ten sections, each with
 * its own slightly different wrapper classes. Pulling them here is not only
 * less code: it is what makes "a surface is a fill plus an elevation" hold
 * across the screen, because there is one place the rule is expressed.
 */

export type SettingsForm = UseFormReturn<SiteSettingsFormValues>;

/** A labelled on/off row. */
export function ToggleRow({
  form,
  name,
  label,
  description,
}: {
  form: SettingsForm;
  // Boolean leaves only; the form's own types are too wide to express that.
  name: string;
  label: string;
  description?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between gap-6 rounded-surface border bg-card p-3.5">
          <div className="space-y-0.5">
            <FormLabel className="cursor-pointer">{label}</FormLabel>
            {description && <FormDescription>{description}</FormDescription>}
          </div>
          <FormControl>
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

/** A titled block inside a group, for when one group has two distinct parts. */
export function FieldGroup({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * One row of an editable list.
 *
 * Reordering is a pair of buttons rather than a drag target on purpose: these
 * lists top out at six or eight entries, and two keyboard-reachable moves are
 * worth more here than pointer dragging, which would need an accessible
 * fallback of exactly this shape anyway.
 */
export function ListRow({
  children,
  onRemove,
  onMoveUp,
  onMoveDown,
  removeLabel,
  position,
}: {
  children: ReactNode;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  removeLabel: string;
  /** Named in the button labels so screen readers can tell the rows apart. */
  position: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex shrink-0 flex-col pt-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={!onMoveUp}
          aria-label={`Move ${position} up`}
          className="rounded-control p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
        >
          <ChevronUp className="size-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={!onMoveDown}
          aria-label={`Move ${position} down`}
          className="rounded-control p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
        >
          <ChevronDown className="size-4" />
        </button>
      </div>

      <div className="min-w-0 flex-1">{children}</div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        aria-label={removeLabel}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

/** The "add another" affordance, with the ceiling stated rather than implied. */
export function AddRowButton({
  onClick,
  label,
  count,
  max,
}: {
  onClick: () => void;
  label: string;
  count: number;
  max: number;
}) {
  const full = count >= max;
  return (
    <div className="flex items-center justify-between gap-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={full}
      >
        <Plus className="mr-1.5 size-3.5" />
        {label}
      </Button>
      <span className="text-xs text-muted-foreground">
        {count} of {max}
      </span>
    </div>
  );
}

/**
 * An editable list of bare strings.
 *
 * Deliberately not `useFieldArray`: that hook keys rows on an object identity
 * it injects into each entry, so it supports arrays of objects and quietly
 * misbehaves on arrays of primitives — `append("")` does not reliably land as
 * an empty string. `bio` and `currently_exploring.items` are both `string[]`
 * in the schema and in the JSONB column, and changing them to objects to suit
 * a form hook would be the form deciding the data shape all over again.
 */
export function useStringList(form: SettingsForm, name: string) {
  // eslint-disable-next-line
  const raw = form.watch(name as never) as unknown;
  const items: string[] = Array.isArray(raw) ? (raw as string[]) : [];

  const commit = (next: string[]) =>
    form.setValue(name as never, next as never, {
      shouldDirty: true,
      shouldValidate: false,
    });

  return {
    items,
    append: () => commit([...items, ""]),
    remove: (index: number) =>
      commit(items.filter((_, position) => position !== index)),
    swap: (a: number, b: number) => {
      const next = [...items];
      [next[a], next[b]] = [next[b], next[a]];
      commit(next);
    },
  };
}
