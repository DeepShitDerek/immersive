"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LibraryHighlight, LibrarySource } from "@/types";
import { useSaveLibraryHighlightMutation } from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { getErrorMessage } from "@/lib/utils";
import {
  libraryHighlightSchema,
  type LibraryHighlightFormValues,
} from "@/lib/schemas";
import { FieldSelect } from "./field-select";
import { HighlightQuote } from "./highlight-widget";
import { embedFor, parseTimestamp } from "./embed";
import { citationFor } from "./library-model";

interface HighlightFormProps {
  highlight: LibraryHighlight | null;
  sources: LibrarySource[];
  /** Preselected when the form is opened from a source. */
  defaultSourceId?: string | null;
  onSuccess: () => void;
}

export function HighlightForm({
  highlight,
  sources,
  defaultSourceId,
  onSuccess,
}: HighlightFormProps) {
  const [save, { isLoading }] = useSaveLibraryHighlightMutation();

  const form = useForm<LibraryHighlightFormValues>({
    resolver: zodResolver(libraryHighlightSchema),
    defaultValues: {
      source_id: highlight?.source_id ?? defaultSourceId ?? "",
      text: highlight?.text ?? "",
      attribution: highlight?.attribution ?? "",
      location: highlight?.location ?? "",
      note: highlight?.note ?? "",
      is_public: highlight?.is_public ?? false,
      is_favorite: highlight?.is_favorite ?? false,
    },
  });

  const sorted = useMemo(
    () => [...sources].sort((a, b) => a.title.localeCompare(b.title)),
    [sources],
  );

  const values = form.watch();
  const source = sources.find((s) => s.id === values.source_id) ?? null;
  const playsAt =
    embedFor(source?.url) && parseTimestamp(values.location) !== null;

  const handleSubmit = async (submitted: LibraryHighlightFormValues) => {
    try {
      await save({
        ...(highlight ? { id: highlight.id } : {}),
        source_id: submitted.source_id || null,
        text: submitted.text.trim(),
        attribution: submitted.attribution?.trim() || null,
        location: submitted.location?.trim() || null,
        note: submitted.note?.trim() || null,
        is_public: submitted.is_public,
        is_favorite: submitted.is_favorite,
      }).unwrap();
      toast.success(highlight ? "Saved." : "Kept.");
      onSuccess();
    } catch (error: unknown) {
      toast.error("Couldn't save it", { description: getErrorMessage(error) });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="text"
          render={({ field }) => (
            <FormItem>
              <FormLabel>The line *</FormLabel>
              <FormControl>
                <Textarea {...field} rows={4} autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="source_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>From</FormLabel>
              <FormControl>
                <FieldSelect {...field} value={field.value ?? ""}>
                  <option value="">No source</option>
                  {sorted.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.creator ? `${s.title} — ${s.creator}` : s.title}
                    </option>
                  ))}
                </FieldSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-[1fr_8rem] gap-4">
          <FormField
            control={form.control}
            name="attribution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Said by</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder={
                      source?.creator
                        ? `${source.creator}, unless someone else`
                        : "Who said it"
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Where</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={field.value ?? ""}
                    placeholder="p. 42, 12:34"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {playsAt && (
          <p className="-mt-2 text-xs text-muted-foreground">
            The player can open at this point.
          </p>
        )}

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Why it stayed with you</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 rounded-surface bg-muted/40 p-4">
          <FormField
            control={form.control}
            name="is_favorite"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 space-y-0">
                <FormLabel className="font-normal">Favourite</FormLabel>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="is_public"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between gap-4 space-y-0">
                <div>
                  <FormLabel className="font-normal">
                    Show on the site
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    It can then appear as the random highlight. Your note stays
                    private.
                  </p>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {/* The visitor's view, rendered by the visitor's component. */}
          {values.is_public && values.text.trim() && (
            <div className="rounded-surface bg-card p-5 pl-8 shadow-e1">
              <HighlightQuote highlight={citationFor(values, source)} />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {highlight ? "Save changes" : "Keep this line"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
