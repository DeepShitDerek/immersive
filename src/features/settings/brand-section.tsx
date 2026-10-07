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
import { ToggleRow, type SettingsForm } from "./settings-controls";

export function BrandSection({ form }: { form: SettingsForm }) {
  return (
    <div className="space-y-5">
      <FormField
        control={form.control}
        name="profile_data.name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Display name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="Ada Lovelace" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="profile_data.logo.main"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo</FormLabel>
              <FormControl>
                <Input {...field} placeholder="FOLIO" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="profile_data.logo.highlight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Highlight</FormLabel>
              <FormControl>
                <Input {...field} placeholder=".DEV" />
              </FormControl>
              <FormDescription>Rendered in the accent colour.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <ToggleRow
        form={form}
        name="profile_data.show_profile_picture"
        label="Show profile picture"
        description="Displays the avatar on the About page."
      />

      <FormField
        control={form.control}
        name="profile_data.profile_picture_url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Picture URL</FormLabel>
            <FormControl>
              <Input {...field} placeholder="https://…" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
