"use client";

import { useFieldArray } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SITE_LIST_LIMITS } from "@/lib/schemas";
import {
  AddRowButton,
  FieldGroup,
  ListRow,
  useStringList,
  type SettingsForm,
} from "./settings-controls";

/**
 * The home page's pitch — headline, supporting line, results — and the About
 * bio.
 *
 * The bio's ceiling comes from `SITE_LIST_LIMITS`, not from how many inputs
 * happen to be drawn; so does the results strip's.
 */
export function HeroSection({ form }: { form: SettingsForm }) {
  const bio = useStringList(form, "profile_data.bio");

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="profile_data.headline"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Headline</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ""}
                placeholder="I build AI systems that make it to production."
              />
            </FormControl>
            <FormDescription>
              The one line a visitor should leave with — the home page&apos;s
              main heading, with your name as the byline. Leave empty to lead
              with your name.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="profile_data.title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Role</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Software Engineer" />
            </FormControl>
            <FormDescription>
              Separate with <code>|</code> to rotate through several.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="profile_data.description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Supporting line</FormLabel>
            <FormControl>
              <Textarea {...field} rows={3} />
            </FormControl>
            <FormDescription>
              Markdown. What you do and for whom, under the headline.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <ProofEditor form={form} />

      <FieldGroup
        title="About bio"
        description="One paragraph per entry, rendered in order on /about."
      >
        <div className="space-y-3">
          {bio.items.map((_, index) => (
            <ListRow
              key={index}
              position={`paragraph ${index + 1}`}
              removeLabel={`Remove paragraph ${index + 1}`}
              onRemove={() => bio.remove(index)}
              onMoveUp={
                index > 0 ? () => bio.swap(index, index - 1) : undefined
              }
              onMoveDown={
                index < bio.items.length - 1
                  ? () => bio.swap(index, index + 1)
                  : undefined
              }
            >
              <FormField
                control={form.control}
                name={`profile_data.bio.${index}` as never}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        aria-label={`Bio paragraph ${index + 1}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </ListRow>
          ))}

          {bio.items.length === 0 && (
            <p className="rounded-surface border bg-card p-4 text-sm text-muted-foreground">
              No bio yet. The About page will show your picture and nothing
              else.
            </p>
          )}

          <AddRowButton
            label="Add paragraph"
            onClick={bio.append}
            count={bio.items.length}
            max={SITE_LIST_LIMITS.BIO_PARAGRAPHS}
          />
        </div>
      </FieldGroup>
    </div>
  );
}

/** The results strip under the hero: a figure and what it measures. */
function ProofEditor({ form }: { form: SettingsForm }) {
  const proof = useFieldArray({
    control: form.control,
    name: "profile_data.proof",
  });

  return (
    <FieldGroup
      title="Results"
      description="Figures you can stand behind, shown in a strip under the hero. A number a client can check beats an adjective. Leave empty to hide the strip."
    >
      <div className="space-y-3">
        {proof.fields.map((entry, index) => (
          <ListRow
            key={entry.id}
            position={`result ${index + 1}`}
            removeLabel={`Remove result ${index + 1}`}
            onRemove={() => proof.remove(index)}
            onMoveUp={
              index > 0 ? () => proof.swap(index, index - 1) : undefined
            }
            onMoveDown={
              index < proof.fields.length - 1
                ? () => proof.swap(index, index + 1)
                : undefined
            }
          >
            <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <FormField
                control={form.control}
                name={`profile_data.proof.${index}.value`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        aria-label={`Result ${index + 1} figure`}
                        placeholder="30%"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`profile_data.proof.${index}.label`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        aria-label={`Result ${index + 1} label`}
                        placeholder="less time on routine support tickets"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </ListRow>
        ))}

        {proof.fields.length === 0 && (
          <p className="rounded-surface border bg-card p-4 text-sm text-muted-foreground">
            No results yet — the hero ends at your links.
          </p>
        )}

        <AddRowButton
          label="Add result"
          onClick={() => proof.append({ value: "", label: "" })}
          count={proof.fields.length}
          max={SITE_LIST_LIMITS.PROOF_POINTS}
        />
      </div>
    </FieldGroup>
  );
}
