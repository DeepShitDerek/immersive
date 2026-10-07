"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LibrarySource } from "@/types";
import { useSaveLibrarySourceMutation } from "@/store/api/adminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  LIBRARY_KINDS,
  LIBRARY_STATUSES,
  librarySourceSchema,
  type LibrarySourceFormValues,
} from "@/lib/schemas";
import { FieldSelect } from "./field-select";
import { embedFor } from "./embed";
import { KIND_LABELS, statusLabel } from "./library-model";

interface SourceFormProps {
  source: LibrarySource | null;
  onSuccess: (saved: LibrarySource) => void;
}

export function SourceForm({ source, onSuccess }: SourceFormProps) {
  const [save, { isLoading }] = useSaveLibrarySourceMutation();

  const form = useForm<LibrarySourceFormValues>({
    resolver: zodResolver(librarySourceSchema),
    defaultValues: {
      kind: source?.kind ?? "book",
      title: source?.title ?? "",
      creator: source?.creator ?? "",
      url: source?.url ?? "",
      status: source?.status ?? "want",
      rating: source?.rating ?? null,
      notes: source?.notes ?? "",
      started_on: source?.started_on ?? "",
      finished_on: source?.finished_on ?? "",
    },
  });

  const kind = form.watch("kind");
  const url = form.watch("url");
  const embed = embedFor(url);

  const handleSubmit = async (values: LibrarySourceFormValues) => {
    try {
      const saved = await save({
        ...(source ? { id: source.id } : {}),
        kind: values.kind,
        title: values.title.trim(),
        creator: values.creator?.trim() || null,
        url: values.url?.trim() || null,
        status: values.status,
        rating: values.rating ?? null,
        notes: values.notes?.trim() || null,
        started_on: values.started_on || null,
        finished_on: values.finished_on || null,
      }).unwrap();
      toast.success(source ? "Saved." : "Added to your library.");
      onSuccess(saved);
    } catch (error: unknown) {
      toast.error("Couldn't save it", { description: getErrorMessage(error) });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title *</FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Dune" autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kind</FormLabel>
                <FormControl>
                  <FieldSelect {...field}>
                    {LIBRARY_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {KIND_LABELS[k]}
                      </option>
                    ))}
                  </FieldSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <FieldSelect {...field}>
                    {LIBRARY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s, kind)}
                      </option>
                    ))}
                  </FieldSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="creator"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Author, host or channel</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  inputMode="url"
                  placeholder="https://…"
                />
              </FormControl>
              {/* Says up front whether this will play here or open elsewhere,
                  rather than leaving it to be discovered later. */}
              {url && (
                <p className="text-xs text-muted-foreground">
                  {embed
                    ? `Plays here — ${embed.label} player.`
                    : "Opens on the original site."}
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="started_on"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Started</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="finished_on"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Finished</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rating</FormLabel>
                <FormControl>
                  <FieldSelect
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value == null ? "" : String(field.value)}
                    onChange={(event) => field.onChange(event.target.value)}
                  >
                    <option value="">None</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} of 5
                      </option>
                    ))}
                  </FieldSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="Who recommended it, what you thought of it…"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {source ? "Save changes" : "Add to library"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
