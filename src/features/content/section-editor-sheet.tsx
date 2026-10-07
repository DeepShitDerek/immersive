"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlignLeft, List } from "lucide-react";
import {
  portfolioSectionSchema,
  type PortfolioSectionFormValues,
} from "@/lib/schemas";
import type { PortfolioSection } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormSheet } from "@/components/admin/shared";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/cn";
import type { PathOption } from "./content-types";
import {
  LAYOUT_GROUPS,
  LAYOUT_OPTIONS,
  LayoutPreview,
} from "./layout-registry";

export interface SectionEditorSheetProps {
  section: Partial<PortfolioSection> | null;
  availablePaths: PathOption[];
  onSave: (data: Partial<PortfolioSection>) => void;
  onClose: () => void;
}

const TYPES = [
  {
    value: "list_items",
    label: "A list of items",
    description: "Services, case studies, experience — laid out by a layout.",
    icon: List,
  },
  {
    value: "markdown",
    label: "Written text",
    description: "Paragraphs, headings and images, written in the editor.",
    icon: AlignLeft,
  },
] as const;

/**
 * A section's settings: its title, the page it is on, what it holds, and how
 * it is laid out.
 *
 * The layout is chosen by looking, not by name. It used to be a dropdown of
 * twenty labels with a separate "Preview all" dialog; the previews are now the
 * choices themselves.
 */
export function SectionEditorSheet({
  section,
  availablePaths,
  onSave,
  onClose,
}: SectionEditorSheetProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PortfolioSectionFormValues>({
    resolver: zodResolver(portfolioSectionSchema),
    defaultValues: {
      title: section?.title ?? "",
      page_path: section?.page_path ?? "/",
      type: section?.type ?? "list_items",
      layout_style: section?.layout_style ?? "default",
      content: section?.content ?? null,
      is_visible: section?.is_visible ?? true,
      show_title: section?.show_title ?? true,
    },
  });

  const selectedLayout = watch("layout_style");
  const selectedType = watch("type");

  const onSubmit = (values: PortfolioSectionFormValues) => {
    onSave({
      id: section?.id,
      title: values.title,
      page_path: values.page_path,
      type: values.type,
      layout_style: values.layout_style,
      show_title: values.show_title,
    });
  };

  return (
    <FormSheet
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={section?.id ? "Section settings" : "New section"}
      description="Where it goes, what it holds, and how it looks."
      wide
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 space-y-6 overflow-y-auto pb-2"
      >
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            {...register("title")}
            placeholder="e.g. What I do"
          />
          {errors.title && (
            <p className="text-xs text-destructive">{errors.title.message}</p>
          )}
        </div>

        {/* Some layouts carry their own heading; a hidden title stays in the
            page as screen-reader text, so the section keeps its name. */}
        <Controller
          name="show_title"
          control={control}
          render={({ field }) => (
            <div className="flex items-start justify-between gap-4 rounded-control bg-secondary/40 px-3.5 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="show_title">Show section title</Label>
                <p className="text-xs text-muted-foreground">
                  When off, the title is hidden on the page but still read by
                  screen readers.
                </p>
              </div>
              <Switch
                id="show_title"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            </div>
          )}
        />

        <div className="space-y-1.5">
          <Label>Page</Label>
          <Controller
            name="page_path"
            control={control}
            render={({ field }) => (
              <Combobox
                options={availablePaths}
                value={field.value}
                onChange={field.onChange}
                placeholder="Choose a page, or type a new path…"
                searchPlaceholder="Search pages…"
                emptyPlaceholder="No pages."
              />
            )}
          />
          {errors.page_path && (
            <p className="text-xs text-destructive">
              {errors.page_path.message}
            </p>
          )}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">What it holds</legend>
          <div
            role="radiogroup"
            aria-label="What it holds"
            className="grid gap-2 sm:grid-cols-2"
          >
            {TYPES.map((type) => {
              const selected = selectedType === type.value;
              const Icon = type.icon;
              return (
                <button
                  key={type.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() =>
                    setValue("type", type.value, { shouldDirty: true })
                  }
                  className={cn(
                    "flex items-start gap-3 rounded-surface border bg-card p-3.5 text-left transition-colors",
                    "focus-ring",
                    selected
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-input hover:bg-secondary/40",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      selected ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {type.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {type.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {selectedType !== "markdown" && (
          <fieldset>
            <legend className="text-sm font-medium">Layout</legend>
            {LAYOUT_GROUPS.map((group) => (
              <div key={group} className="mt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {group}
                </p>
                <div
                  role="radiogroup"
                  aria-label={`${group} layouts`}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  {LAYOUT_OPTIONS.filter((o) => o.group === group).map(
                    (option) => {
                      const selected = selectedLayout === option.value;
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          title={option.description}
                          onClick={() =>
                            setValue("layout_style", option.value, {
                              shouldDirty: true,
                            })
                          }
                          className={cn(
                            "min-w-0 rounded-surface border bg-card p-2 text-left transition-colors",
                            "focus-ring",
                            selected
                              ? "border-primary ring-1 ring-primary"
                              : "hover:border-input hover:bg-secondary/40",
                          )}
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none block h-[7.5rem] overflow-hidden rounded-control bg-background/60 p-2"
                          >
                            <LayoutPreview layout={option.value} />
                          </span>
                          <span className="mt-2 flex items-start gap-1.5 text-xs font-medium leading-snug">
                            <Icon
                              className={cn(
                                "mt-px size-3.5 shrink-0",
                                selected
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 break-words">
                              {option.label}
                            </span>
                          </span>
                        </button>
                      );
                    },
                  )}
                </div>
              </div>
            ))}
          </fieldset>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save section</Button>
        </div>
      </form>
    </FormSheet>
  );
}
