"use client";

import { BookImage, Clock, FileStack, Layers } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { FieldGroup, type SettingsForm } from "./settings-controls";

/** A radio rendered as a selectable surface rather than a bordered tile. */
function ChoiceTile({
  value,
  icon: Icon,
  title,
  note,
  selected,
}: {
  value: string;
  icon: typeof Clock;
  title: string;
  note: string;
  selected: boolean;
}) {
  return (
    <FormItem className="space-y-0">
      <FormControl>
        <RadioGroupItem value={value} className="peer sr-only" />
      </FormControl>
      <FormLabel
        className={cn(
          "flex h-full cursor-pointer flex-col gap-2 rounded-surface border bg-card p-4 font-normal transition-colors",
          selected
            ? "border-primary ring-1 ring-primary"
            : "hover:border-input",
        )}
      >
        <Icon
          className={cn(
            "size-5",
            selected ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="text-sm font-medium text-foreground">{title}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {note}
        </span>
      </FormLabel>
    </FormItem>
  );
}

export function LayoutSection({ form }: { form: SettingsForm }) {
  const mode = form.watch("portfolio_mode");
  const updates = form.watch("profile_data.updates_layout");

  return (
    <div className="space-y-6">
      <FieldGroup
        title="Portfolio mode"
        description="Whether the public site is a set of routes or one scrolling page."
      >
        <FormField
          control={form.control}
          name="portfolio_mode"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <ChoiceTile
                    value="multi-page"
                    icon={FileStack}
                    title="Multi-page"
                    note="Home, About, Projects and Contact as separate routes."
                    selected={mode === "multi-page"}
                  />
                  <ChoiceTile
                    value="single-page"
                    icon={Layers}
                    title="Single-page"
                    note="Everything stacked on one page, navigation scrolls."
                    selected={mode === "single-page"}
                  />
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
      </FieldGroup>

      <FieldGroup
        title="Updates feed"
        description="How life updates are arranged on /updates."
      >
        <FormField
          control={form.control}
          name="profile_data.updates_layout"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value || "scrapbook"}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <ChoiceTile
                    value="scrapbook"
                    icon={BookImage}
                    title="Wall"
                    note="Every update at a glance, in columns, newest across the top."
                    selected={(updates || "scrapbook") === "scrapbook"}
                  />
                  <ChoiceTile
                    value="timeline"
                    icon={Clock}
                    title="Journal"
                    note="One reading column, a month at a time, dated in the margin."
                    selected={updates === "timeline"}
                  />
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
      </FieldGroup>
    </div>
  );
}
