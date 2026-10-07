"use client";

import { useFieldArray } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SITE_LIST_LIMITS } from "@/lib/schemas";
import { socialIcon } from "@/lib/social-icons";
import { AddRowButton, ListRow, type SettingsForm } from "./settings-controls";

/**
 * Social links, as an open list.
 *
 * The previous version mapped over the three links hard-coded in
 * `site-identity-defaults.ts` and merged stored values in by `id`. Two
 * consequences: a fourth link could not be added at all, and a link already in
 * the database whose id was not one of those three did not appear in the form
 * — and was therefore dropped from the row the next time settings were saved.
 */

/** Common platforms, offered as one-click starts rather than a fixed list. */
const QUICK_ADD = [
  { id: "github", label: "GitHub" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
  { id: "twitter", label: "X" },
  { id: "mastodon", label: "Mastodon" },
  { id: "website", label: "Website" },
] as const;

export function SocialLinksSection({ form }: { form: SettingsForm }) {
  const links = useFieldArray({ control: form.control, name: "social_links" });
  const used = new Set(
    form.watch("social_links")?.map((link) => link?.id?.toLowerCase()) ?? [],
  );

  const add = (id: string, label: string) => {
    if (links.fields.length >= SITE_LIST_LIMITS.SOCIAL_LINKS) return;
    links.append({ id, label, url: "", is_visible: true });
  };

  const available = QUICK_ADD.filter((option) => !used.has(option.id));

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        {links.fields.map((entry, index) => {
          const id = form.watch(`social_links.${index}.id`) ?? "";
          const Icon = socialIcon(id);
          return (
            <ListRow
              key={entry.id}
              position={`link ${index + 1}`}
              removeLabel={`Remove link ${index + 1}`}
              onRemove={() => links.remove(index)}
              onMoveUp={
                index > 0 ? () => links.swap(index, index - 1) : undefined
              }
              onMoveDown={
                index < links.fields.length - 1
                  ? () => links.swap(index, index + 1)
                  : undefined
              }
            >
              <div className="space-y-3 rounded-surface border bg-card p-3.5">
                <div className="flex items-center gap-3">
                  <Icon
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <FormField
                    control={form.control}
                    name={`social_links.${index}.label`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormControl>
                          <Input
                            {...field}
                            aria-label={`Link ${index + 1} label`}
                            placeholder="Label"
                            className="h-8"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`social_links.${index}.is_visible`}
                    render={({ field }) => (
                      <FormItem className="flex shrink-0 items-center gap-2">
                        <FormLabel className="text-xs text-muted-foreground">
                          Visible
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label={`Show link ${index + 1}`}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                  <FormField
                    control={form.control}
                    name={`social_links.${index}.id`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            aria-label={`Link ${index + 1} id`}
                            placeholder="id"
                            className="h-8 text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`social_links.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            {...field}
                            aria-label={`Link ${index + 1} URL`}
                            placeholder="https://…  or  mailto:you@example.com"
                            className="h-8"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </ListRow>
          );
        })}

        {links.fields.length === 0 && (
          <p className="rounded-surface border bg-card p-4 text-sm text-muted-foreground">
            No links yet. Add one below — the hero, the footer and the contact
            page all read from this list.
          </p>
        )}
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Quick add:</span>
          {available.map((option) => (
            <Button
              key={option.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={links.fields.length >= SITE_LIST_LIMITS.SOCIAL_LINKS}
              onClick={() => add(option.id, option.label)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}

      <AddRowButton
        label="Add link"
        onClick={() => add(`link-${links.fields.length + 1}`, "")}
        count={links.fields.length}
        max={SITE_LIST_LIMITS.SOCIAL_LINKS}
      />
    </div>
  );
}
