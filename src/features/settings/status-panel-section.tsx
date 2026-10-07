"use client";

import { Input } from "@/components/ui/input";
import {
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
import { SITE_LIST_LIMITS } from "@/lib/schemas";
import {
  AddRowButton,
  FieldGroup,
  ListRow,
  ToggleRow,
  useStringList,
  type SettingsForm,
} from "./settings-controls";

export function StatusPanelSection({ form }: { form: SettingsForm }) {
  const exploring = useStringList(
    form,
    "profile_data.status_panel.currently_exploring.items",
  );

  return (
    <div className="space-y-6">
      <ToggleRow
        form={form}
        name="profile_data.status_panel.show"
        label="Show the panel"
        description="The card beside the hero on the home page."
      />

      <FormField
        control={form.control}
        name="profile_data.status_panel.design"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Design</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value ?? "minimal"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="minimal">
                  Minimal — editorial card
                </SelectItem>
                {/* Stored values kept for existing rows; the designs changed. */}
                <SelectItem value="terminal">
                  Spotlight — inverted feature card
                </SelectItem>
                <SelectItem value="bento">
                  Stack — cards like a wallet
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="profile_data.status_panel.availability"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Availability</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Open to work — remote" />
            </FormControl>
            <FormDescription>
              Also drives the badge on the contact page.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FieldGroup
        title="Currently exploring"
        description="Short lines — a language, a book, a side project."
      >
        <FormField
          control={form.control}
          name="profile_data.status_panel.currently_exploring.title"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  aria-label="Exploring heading"
                  placeholder="Exploring"
                  className="h-9"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          {exploring.items.map((_, index) => (
            <ListRow
              key={index}
              position={`item ${index + 1}`}
              removeLabel={`Remove item ${index + 1}`}
              onRemove={() => exploring.remove(index)}
              onMoveUp={
                index > 0 ? () => exploring.swap(index, index - 1) : undefined
              }
              onMoveDown={
                index < exploring.items.length - 1
                  ? () => exploring.swap(index, index + 1)
                  : undefined
              }
            >
              <FormField
                control={form.control}
                name={
                  `profile_data.status_panel.currently_exploring.items.${index}` as never
                }
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        aria-label={`Exploring item ${index + 1}`}
                        className="h-9"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </ListRow>
          ))}
        </div>

        <AddRowButton
          label="Add item"
          onClick={exploring.append}
          count={exploring.items.length}
          max={SITE_LIST_LIMITS.EXPLORING_ITEMS}
        />
      </FieldGroup>

      <FieldGroup
        title="Latest project"
        description="A single pointer at the bottom of the panel. Leave the name blank to hide it."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="profile_data.status_panel.latestProject.name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Name</FormLabel>
                <FormControl>
                  <Input {...field} className="h-9" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profile_data.status_panel.latestProject.linkText"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Link text</FormLabel>
                <FormControl>
                  <Input {...field} className="h-9" placeholder="View" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="profile_data.status_panel.latestProject.href"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Destination</FormLabel>
              <FormControl>
                <Input {...field} className="h-9" placeholder="/work" />
              </FormControl>
              <FormDescription>
                A path on this site, or a full URL.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </FieldGroup>
    </div>
  );
}
